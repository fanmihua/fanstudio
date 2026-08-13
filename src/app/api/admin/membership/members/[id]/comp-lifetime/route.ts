import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { calculateLifetimeUpgradeCredit, grantMembership } from "@/lib/membership"
import { getPaymentConfig } from "@/lib/payment-config"
import { createWxPayFromConfig } from "@/lib/wechatpay"
import { logMembershipEvent } from "@/lib/membership-events"

export const dynamic = "force-dynamic"

const DAY_MS = 86_400_000
const DEFAULT_NOTE = "管理员赠送长期权益"

type RefundMode = "NONE" | "WECHAT" | "OFFLINE"

type RefundOrder = {
  id: string
  orderNo: string
  amount: Prisma.Decimal
  grantsDays: number | null
  paidAt: Date | null
  createdAt: Date
  paymentId: string | null
}

function activeEntitlement(e: { revokedAt: Date | null; isLifetime: boolean; expiresAt: Date | null }): boolean {
  if (e.revokedAt) return false
  if (e.isLifetime) return true
  return !!e.expiresAt && e.expiresAt.getTime() > Date.now()
}

function buildWechatRefundAllocations(orders: RefundOrder[], refundYuan: number, now = new Date()) {
  let cursor: Date | null = null
  const candidates: Array<RefundOrder & { refundableFen: number; totalFen: number }> = []

  for (const order of orders) {
    const days = order.grantsDays ?? 0
    if (days <= 0) continue

    const paidAt: Date = order.paidAt ?? order.createdAt ?? now
    const start: Date = cursor && cursor > paidAt ? cursor : paidAt
    const end: Date = new Date(start.getTime() + days * DAY_MS)
    cursor = end
    if (end <= now) continue

    const unusedStart = start > now ? start : now
    const unusedMs = Math.max(0, end.getTime() - unusedStart.getTime())
    if (unusedMs <= 0) continue

    const amountYuan = Number(order.amount)
    if (!Number.isFinite(amountYuan) || amountYuan <= 0) continue

    const rawRefundYuan = amountYuan * (unusedMs / (days * DAY_MS))
    const refundableFen = Math.max(0, Math.floor(rawRefundYuan * 100 + 1e-6))
    const totalFen = Math.max(0, Math.round(amountYuan * 100))
    if (refundableFen <= 0 || totalFen <= 0) continue
    candidates.push({ ...order, refundableFen: Math.min(refundableFen, totalFen), totalFen })
  }

  let remainingFen = Math.max(0, Math.round(refundYuan * 100))
  const allocations: Array<RefundOrder & { refundFen: number; totalFen: number }> = []
  for (const order of [...candidates].reverse()) {
    if (remainingFen <= 0) break
    if (!order.paymentId) continue
    const refundFen = Math.min(remainingFen, order.refundableFen)
    if (refundFen <= 0) continue
    allocations.push({ ...order, refundFen, totalFen: order.totalFen })
    remainingFen -= refundFen
  }

  return {
    allocations: allocations.reverse(),
    refundableYuan: (Math.round(refundYuan * 100) - remainingFen) / 100,
    enough: remainingFen === 0,
  }
}

async function getContext(memberId: string, productKey: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, email: true } })
  if (!member) return { error: "会员不存在" as const }

  const product = await prisma.product.findUnique({ where: { key: productKey }, select: { id: true, key: true, name: true } })
  if (!product) return { error: "产品不存在" as const }

  const entitlement = await prisma.entitlement.findUnique({
    where: { memberId_productId: { memberId: member.id, productId: product.id } },
    select: { isLifetime: true, expiresAt: true, revokedAt: true, source: true },
  })

  const orders = await prisma.membershipOrder.findMany({
    where: {
      memberId: member.id,
      productId: product.id,
      status: "PAID",
      source: "PURCHASE",
      isLifetime: false,
      grantsDays: { not: null },
    },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      orderNo: true,
      source: true,
      amount: true,
      grantsDays: true,
      paidAt: true,
      createdAt: true,
      paymentId: true,
    },
  })

  const quote = calculateLifetimeUpgradeCredit(orders)
  const wechat = buildWechatRefundAllocations(orders, quote.creditYuan)
  return { member, product, entitlement, orders, quote, wechat }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params
  const productKey = new URL(request.url).searchParams.get("productKey")?.trim() || ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const ctx = await getContext(id, productKey)
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 404 })

  const isActive = !!ctx.entitlement && activeEntitlement(ctx.entitlement)
  const alreadyCompLifetime = isActive && ctx.entitlement?.isLifetime && ctx.entitlement.source === "COMP"

  return NextResponse.json({
    member: ctx.member,
    product: ctx.product,
    current: ctx.entitlement,
    eligible: isActive && !alreadyCompLifetime,
    alreadyCompLifetime,
    suggestedRefundYuan: ctx.quote.creditYuan,
    rawRefundYuan: ctx.quote.rawCreditYuan,
    unusedDays: ctx.quote.unusedDays,
    eligibleOrderCount: ctx.quote.eligibleOrderCount,
    canWechatRefund: ctx.quote.creditYuan > 0 && ctx.wechat.enough,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params
  let body: { productKey?: unknown; refundMode?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const productKey = typeof body.productKey === "string" ? body.productKey.trim() : ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const refundMode: RefundMode =
    body.refundMode === "WECHAT" || body.refundMode === "OFFLINE" || body.refundMode === "NONE"
      ? body.refundMode
      : "NONE"
  const note = (typeof body.note === "string" ? body.note.trim() : "") || DEFAULT_NOTE

  const ctx = await getContext(id, productKey)
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 404 })

  const isActive = !!ctx.entitlement && activeEntitlement(ctx.entitlement)
  if (!isActive) return NextResponse.json({ error: "当前没有有效权益，不能从订阅转赠送永久" }, { status: 400 })
  if (ctx.entitlement?.isLifetime && ctx.entitlement.source === "COMP") {
    return NextResponse.json({ error: "该会员已经是赠送永久" }, { status: 400 })
  }

  const suggestedRefundYuan = ctx.quote.creditYuan
  const refundDetails: Array<{ orderNo: string; refundYuan: number }> = []

  if (refundMode === "WECHAT") {
    if (suggestedRefundYuan <= 0) {
      return NextResponse.json({ error: "没有可原路退款的未使用金额" }, { status: 400 })
    }
    if (!ctx.wechat.enough) {
      return NextResponse.json({ error: "可退款订单不足，无法按建议金额发起微信原路退款" }, { status: 400 })
    }
    const config = await getPaymentConfig()
    const pay = createWxPayFromConfig(config)
    if (!pay) {
      return NextResponse.json({ error: "未配置微信支付，无法原路退款" }, { status: 400 })
    }

    for (const [index, order] of ctx.wechat.allocations.entries()) {
      const outRefundNo = `${order.orderNo}-CL${Date.now().toString().slice(-8)}${index}`
      try {
        await pay.refunds({
          out_trade_no: order.orderNo,
          out_refund_no: outRefundNo,
          amount: { total: order.totalFen, currency: "CNY", refund: order.refundFen },
          reason: "转为赠送长期权益退款",
        })
        refundDetails.push({ orderNo: order.orderNo, refundYuan: order.refundFen / 100 })
      } catch (err) {
        const message = err instanceof Error ? err.message : "微信退款请求失败"
        await logMembershipEvent({
          type: "COMP_LIFETIME_TRANSFER",
          level: "ERROR",
          message: `转赠送永久微信退款失败：${message}`,
          memberId: ctx.member.id,
          productId: ctx.product.id,
          email: ctx.member.email,
          metadata: { refundMode, suggestedRefundYuan, refundDetails },
        })
        return NextResponse.json({ error: `微信退款失败：${message}` }, { status: 502 })
      }
    }
  }

  await grantMembership({ productId: ctx.product.id, email: ctx.member.email, days: null, note: note.slice(0, 255) })
  await logMembershipEvent({
    type: "COMP_LIFETIME_TRANSFER",
    message: "已转为赠送长期权益",
    memberId: ctx.member.id,
    productId: ctx.product.id,
    email: ctx.member.email,
    metadata: {
      refundMode,
      suggestedRefundYuan,
      actualRefundYuan: refundMode === "WECHAT" ? refundDetails.reduce((sum, item) => sum + item.refundYuan, 0) : refundMode === "OFFLINE" ? suggestedRefundYuan : 0,
      rawRefundYuan: ctx.quote.rawCreditYuan,
      unusedDays: ctx.quote.unusedDays,
      eligibleOrderCount: ctx.quote.eligibleOrderCount,
      refundDetails,
      note,
    },
  })

  return NextResponse.json({
    ok: true,
    suggestedRefundYuan,
    actualRefundYuan: refundMode === "WECHAT" ? refundDetails.reduce((sum, item) => sum + item.refundYuan, 0) : 0,
  })
}
