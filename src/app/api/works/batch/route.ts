import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { safeDeleteKnowledgeSource, safeSyncManySources } from "@/lib/ai/knowledge-trigger"
import { safeRunMediaCleanupCycle } from "@/lib/media-cleanup"

export const dynamic = "force-dynamic"

/** DELETE: 批量删除作品；有关联订单的跳过并在响应中返回 blocked 列表。body: { ids }。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }

  const worksWithOrders = await prisma.order.groupBy({
    by: ["workId"],
    where: { workId: { in: ids } },
    _count: true,
  })
  const blockedIds = new Set(worksWithOrders.map((w) => w.workId))
  const deletableIds = ids.filter((id: string) => !blockedIds.has(id))

  if (deletableIds.length > 0) {
    await prisma.work.deleteMany({ where: { id: { in: deletableIds } } })
    for (const id of deletableIds) {
      await safeDeleteKnowledgeSource("WORK", id)
    }
    await safeRunMediaCleanupCycle("work:batch-delete")
  }

  if (blockedIds.size > 0) {
    const blockedWorks = await prisma.work.findMany({
      where: { id: { in: Array.from(blockedIds) } },
      select: { id: true, title: true },
    })
    const names = blockedWorks.map((w) => `「${w.title}」`).join("、")
    return NextResponse.json({
      ok: true,
      partial: true,
      deleted: deletableIds.length,
      blocked: blockedWorks.map((w) => ({ id: w.id, title: w.title })),
      message: `${names} 有关联订单，无法删除`,
    })
  }

  return NextResponse.json({ ok: true })
}

/** PATCH: 批量更新作品状态。body: { ids, status }，status 为 PUBLISHED 或 DRAFT。 */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { ids, status } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  if (!["PUBLISHED", "DRAFT"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }
  await prisma.work.updateMany({
    where: { id: { in: ids } },
    data: { status },
  })
  if (status === "PUBLISHED") {
    await safeSyncManySources("WORK", ids as string[])
  } else {
    for (const id of ids as string[]) {
      await safeDeleteKnowledgeSource("WORK", id)
    }
  }
  return NextResponse.json({ ok: true })
}
