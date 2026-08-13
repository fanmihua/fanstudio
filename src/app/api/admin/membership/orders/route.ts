import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { dangerDeleteError, isDangerDeleteConfirmed } from "@/lib/admin-delete-guard"
import prisma from "@/lib/prisma"
import type { MembershipOrderSource, OrderStatus, Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const ORDER_STATUSES = new Set<OrderStatus>(["PENDING", "PAID", "CANCELLED", "REFUNDED"])
const ORDER_SOURCES = new Set<MembershipOrderSource>(["PURCHASE", "COMP"])

/** GET: 会员订单列表（最近 200 条）。 */
export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const source = searchParams.get("source")
  const promo = searchParams.get("promo") || "all"
  const archive = searchParams.get("archive") || "active"
  const q = searchParams.get("q")?.trim()

  const where: Prisma.MembershipOrderWhereInput = {}
  if (status && status !== "all" && ORDER_STATUSES.has(status as OrderStatus)) where.status = status as OrderStatus
  if (source && source !== "all" && ORDER_SOURCES.has(source as MembershipOrderSource)) {
    where.source = source as MembershipOrderSource
  }
  if (promo === "with") where.promoCodeText = { not: null }
  else if (promo === "none") where.promoCodeText = null
  if (archive === "archived") where.archivedAt = { not: null }
  else if (archive !== "all") where.archivedAt = null
  if (q) {
    where.OR = [
      { orderNo: { contains: q } },
      { buyerEmail: { contains: q } },
      { planName: { contains: q } },
      { promoCodeText: { contains: q } },
    ]
  }

  const orders = await prisma.membershipOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { member: { select: { email: true } } },
  })

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      email: o.member?.email ?? o.buyerEmail,
      planName: o.planName,
      source: o.source,
      amount: Number(o.amount),
      status: o.status,
      isLifetime: o.isLifetime,
      grantsDays: o.grantsDays,
      note: o.note,
      promoCode: o.promoCodeText,
      hasPayment: !!o.paymentId,
      paidAt: o.paidAt,
      refundedAt: o.refundedAt,
      archivedAt: o.archivedAt,
      createdAt: o.createdAt,
    })),
  )
}

/** PATCH: 恢复已归档会员订单。body: { action:'restore'|'archive' }，?id=xxx。 */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const id = new URL(request.url).searchParams.get("id")?.trim() || ""
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 })

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }
  if (body.action !== "restore" && body.action !== "archive") {
    return NextResponse.json({ error: "无效操作" }, { status: 400 })
  }

  await prisma.membershipOrder.update({
    where: { id },
    data: { archivedAt: body.action === "restore" ? null : new Date() },
  })
  return NextResponse.json({ ok: true })
}

/** DELETE: 归档会员订单。仅从默认后台列表隐藏，不退款、不自动调整会员权益。body: { confirmText }，?id=xxx。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const id = new URL(request.url).searchParams.get("id")?.trim() || ""
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 })

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  if (!isDangerDeleteConfirmed(body)) {
    return NextResponse.json(dangerDeleteError(), { status: 400 })
  }

  const order = await prisma.membershipOrder.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 })

  await prisma.membershipOrder.update({ where: { id }, data: { archivedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
