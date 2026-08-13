/** 留言板单条管理：删除（级联回复）/ 隐藏切换。仅管理员。 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"

export const dynamic = "force-dynamic"

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  // onDelete: Cascade 会一并删除其回复
  await prisma.guestbookMessage.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const data: { hidden?: boolean; pinned?: boolean } = {}
  if (typeof body.hidden === "boolean") data.hidden = body.hidden
  if (typeof body.pinned === "boolean") data.pinned = body.pinned
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "无可更新字段" }, { status: 400 })
  }

  const updated = await prisma.guestbookMessage.update({ where: { id }, data })
  return NextResponse.json(updated)
}
