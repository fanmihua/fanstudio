import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { safeDeleteKnowledgeSource, safeSyncManySources } from "@/lib/ai/knowledge-trigger"
import { safeRunMediaCleanupCycle } from "@/lib/media-cleanup"

export const dynamic = "force-dynamic"

/** DELETE: 批量删除文章。body: { ids }，需管理员登录。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  await prisma.post.deleteMany({ where: { id: { in: ids } } })
  for (const id of ids as string[]) {
    await safeDeleteKnowledgeSource("POST", id)
  }
  await safeRunMediaCleanupCycle("post:batch-delete")
  return NextResponse.json({ ok: true })
}

/** PATCH: 批量更新文章状态。body: { ids, status }，status 为 PUBLISHED 或 DRAFT。 */
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
  await prisma.post.updateMany({
    where: { id: { in: ids } },
    data: { status },
  })
  if (status === "PUBLISHED") {
    await safeSyncManySources("POST", ids as string[])
  } else {
    for (const id of ids as string[]) {
      await safeDeleteKnowledgeSource("POST", id)
    }
  }
  return NextResponse.json({ ok: true })
}
