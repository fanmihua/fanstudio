import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { safeDeleteKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { safeRunMediaCleanupCycle } from "@/lib/media-cleanup"

export const dynamic = "force-dynamic"

/** DELETE: 批量删除教程。body: { ids }，需管理员登录。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  await prisma.videoTutorial.deleteMany({ where: { id: { in: ids } } })
  for (const id of ids as string[]) {
    await safeDeleteKnowledgeSource("TUTORIAL", id)
  }
  await safeRunMediaCleanupCycle("tutorial:batch-delete")
  return NextResponse.json({ ok: true })
}
