import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { dangerDeleteError, isDangerDeleteConfirmed } from "@/lib/admin-delete-guard"
import prisma from "@/lib/prisma"
import { revokeEntitlement, adjustEntitlement, setMemberDisabled } from "@/lib/membership"

export const dynamic = "force-dynamic"

/**
 * PATCH: 会员管控。body: { action, productKey?, days? }。
 *  - revoke (productKey)            撤销某产品权益
 *  - adjust (productKey, days|null) 改有效期（null=永久，<=0=立即过期）
 *  - ban / unban                    封禁 / 解禁整个账号
 *  - restore                        恢复归档账号
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params
  const member = await prisma.member.findUnique({ where: { id }, select: { id: true } })
  if (!member) {
    return NextResponse.json({ error: "会员不存在" }, { status: 404 })
  }

  let body: { action?: string; productKey?: string; days?: number | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  async function resolveProductId(key?: string): Promise<string | null> {
    if (!key) return null
    const p = await prisma.product.findUnique({ where: { key }, select: { id: true } })
    return p?.id ?? null
  }

  switch (body.action) {
    case "revoke": {
      const pid = await resolveProductId(body.productKey)
      if (!pid) return NextResponse.json({ error: "缺少有效产品" }, { status: 400 })
      await revokeEntitlement(id, pid)
      return NextResponse.json({ ok: true })
    }
    case "adjust": {
      const pid = await resolveProductId(body.productKey)
      if (!pid) return NextResponse.json({ error: "缺少有效产品" }, { status: 400 })
      const days = body.days === null || body.days === undefined ? null : Number(body.days)
      if (days !== null && !Number.isInteger(days)) {
        return NextResponse.json({ error: "天数无效" }, { status: 400 })
      }
      await adjustEntitlement(id, pid, days)
      return NextResponse.json({ ok: true })
    }
    case "ban":
      await setMemberDisabled(id, true)
      return NextResponse.json({ ok: true })
    case "unban":
      await setMemberDisabled(id, false)
      return NextResponse.json({ ok: true })
    case "restore":
      await prisma.member.update({ where: { id }, data: { archivedAt: null } })
      return NextResponse.json({ ok: true })
    default:
      return NextResponse.json({ error: "无效操作" }, { status: 400 })
  }
}

/** DELETE: 归档会员账号，并清理当前登录会话；权益/订单/进度保留，可恢复。body: { confirmText }。 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params
  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  if (!isDangerDeleteConfirmed(body)) {
    return NextResponse.json(dangerDeleteError(), { status: 400 })
  }

  const member = await prisma.member.findUnique({ where: { id }, select: { id: true, email: true } })
  if (!member) {
    return NextResponse.json({ error: "会员不存在" }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.memberSession.deleteMany({ where: { memberId: id } }),
    prisma.member.update({ where: { id }, data: { archivedAt: new Date() } }),
  ])
  return NextResponse.json({ ok: true })
}
