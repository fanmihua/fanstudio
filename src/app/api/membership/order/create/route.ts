import { NextRequest, NextResponse } from "next/server"
import { MembershipPlanKey } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getCurrentMember } from "@/lib/require-member"
import { generateMembershipOrderNo, getLifetimeUpgradeQuote } from "@/lib/membership"
import { logMembershipEvent } from "@/lib/membership-events"
import { checkPromoCode, discountedYuan } from "@/lib/promo"
import { checkRouteRateLimit, rateLimitJson } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const VALID_KEYS = Object.values(MembershipPlanKey) as string[]

/** POST: 登录会员下单。body: { planKey, product }。建 MembershipOrder(PENDING)，返回 orderNo + 金额。 */
export async function POST(request: NextRequest) {
  const ipLimit = checkRouteRateLimit(request, { namespace: "mbr-order-ip", limit: 20, windowMs: 60_000 })
  if (!ipLimit.ok) return rateLimitJson(ipLimit.retryAfter)

  const member = await getCurrentMember()
  if (!member || member.disabled) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }
  const memberLimit = checkRouteRateLimit(request, {
    namespace: "mbr-order-member",
    key: member.id,
    limit: 8,
    windowMs: 60_000,
  })
  if (!memberLimit.ok) return rateLimitJson(memberLimit.retryAfter)

  let body: { planKey?: string; product?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const planKey = body.planKey
  if (!planKey || !VALID_KEYS.includes(planKey)) {
    return NextResponse.json({ error: "套餐无效" }, { status: 400 })
  }

  const productKey = body.product?.trim() || ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await prisma.product.findUnique({ where: { key: productKey } })
  if (!product || !product.enabled) {
    return NextResponse.json({ error: "产品不存在或已下架" }, { status: 404 })
  }

  const plan = await prisma.membershipPlan.findUnique({
    where: { productId_key: { productId: product.id, key: planKey as MembershipPlanKey } },
  })
  if (!plan || !plan.enabled) {
    return NextResponse.json({ error: "套餐不存在或已下架" }, { status: 404 })
  }

  const isLifetime = plan.durationDays == null
  const currentEntitlement = await prisma.entitlement.findUnique({
    where: { memberId_productId: { memberId: member.id, productId: product.id } },
    select: { isLifetime: true, revokedAt: true },
  })
  if (currentEntitlement?.isLifetime && !currentEntitlement.revokedAt) {
    return NextResponse.json({ error: "你已拥有通行权益，无需重复购买" }, { status: 400 })
  }

  // —— 折扣码（可选）。金额一律服务端重算，绝不信前端 ——
  let amount = Number(plan.price)
  let promoCodeId: string | null = null
  let promoCodeText: string | null = null
  if (body.code && body.code.trim()) {
    const check = await checkPromoCode({ rawCode: body.code, productId: product.id, memberId: member.id })
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
    // 码限定了套餐则必须匹配
    if (check.planKey && check.planKey !== plan.key) {
      return NextResponse.json({ error: "兑换码不适用此套餐" }, { status: 400 })
    }
    amount = discountedYuan(Number(plan.price), check.percentOff)
    if (!(amount > 0) || amount >= Number(plan.price)) {
      return NextResponse.json({ error: "折扣金额异常" }, { status: 400 })
    }
    promoCodeId = check.codeId
    promoCodeText = check.codeText
  }

  let upgradeCredit = 0
  if (isLifetime) {
    const quote = await getLifetimeUpgradeQuote(member.id, product.id)
    if (quote.eligible && quote.creditYuan > 0) {
      upgradeCredit = Math.min(quote.creditYuan, Math.max(0, Math.floor(amount) - 1))
      amount = Math.max(1, amount - upgradeCredit)
    }
  }

  const recentSince = new Date(Date.now() - 15 * 60_000)
  const existingPending = await prisma.membershipOrder.findFirst({
    where: {
      memberId: member.id,
      productId: product.id,
      planId: plan.id,
      source: "PURCHASE",
      amount,
      status: "PENDING",
      promoCodeText,
      createdAt: { gt: recentSince },
    },
    orderBy: { createdAt: "desc" },
  })
  if (existingPending) {
    void logMembershipEvent({
      type: "ORDER_REUSED",
      message: "复用 15 分钟内相同的待支付会员订单",
      orderId: existingPending.id,
      orderNo: existingPending.orderNo,
      memberId: member.id,
      productId: product.id,
      email: member.email,
      metadata: {
        planKey: plan.key,
        planName: existingPending.planName,
        amount: Number(existingPending.amount),
        promoCode: existingPending.promoCodeText,
        upgradeCredit,
      },
    })
    return NextResponse.json({
      orderNo: existingPending.orderNo,
      amount: Number(existingPending.amount),
      originalAmount: Number(plan.price),
      planName: existingPending.planName,
      isLifetime: existingPending.isLifetime,
      promoCode: existingPending.promoCodeText,
      upgradeCredit,
      reused: true,
    })
  }

  const pendingCount = await prisma.membershipOrder.count({
    where: {
      memberId: member.id,
      productId: product.id,
      source: "PURCHASE",
      status: "PENDING",
      createdAt: { gt: new Date(Date.now() - 30 * 60_000) },
    },
  })
  if (pendingCount >= 8) {
    return NextResponse.json({ error: "待支付订单较多，请稍后再试" }, { status: 429 })
  }

  const order = await prisma.membershipOrder.create({
    data: {
      orderNo: generateMembershipOrderNo(),
      memberId: member.id,
      productId: product.id,
      planId: plan.id,
      planKey: plan.key,
      planName: plan.name,
      source: "PURCHASE",
      amount,
      status: "PENDING",
      grantsDays: plan.durationDays ?? null,
      isLifetime,
      buyerEmail: member.email,
      promoCodeId,
      promoCodeText,
      note: upgradeCredit > 0 ? `升级抵扣 ¥${upgradeCredit}` : null,
    },
  })

  void logMembershipEvent({
    type: "ORDER_CREATED",
    message: "创建会员待支付订单",
    orderId: order.id,
    orderNo: order.orderNo,
    memberId: member.id,
    productId: product.id,
    email: member.email,
    metadata: {
      planKey: plan.key,
      planName: plan.name,
      amount: Number(order.amount),
      promoCode: promoCodeText,
      upgradeCredit,
    },
  })

  return NextResponse.json({
    orderNo: order.orderNo,
    amount: Number(order.amount),
    originalAmount: Number(plan.price),
    planName: plan.name,
    isLifetime,
    promoCode: promoCodeText,
    upgradeCredit,
  })
}
