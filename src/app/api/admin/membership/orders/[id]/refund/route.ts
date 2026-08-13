import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { getPaymentConfig } from "@/lib/payment-config"
import { createWxPayFromConfig } from "@/lib/wechatpay"
import { revertEntitlementForRefund } from "@/lib/membership"

export const dynamic = "force-dynamic"

/** POST: 对已支付的「付费」会员订单原路退款 → 标 REFUNDED → 扣减该会员有效期（本单天数 / 取消永久）。 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params
  const order = await prisma.membershipOrder.findUnique({ where: { id } })
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }
  if (order.status !== "PAID") {
    return NextResponse.json({ error: "仅已支付订单可退款" }, { status: 400 })
  }
  if (order.source !== "PURCHASE" || Number(order.amount) <= 0 || !order.paymentId) {
    return NextResponse.json(
      { error: "该订单非微信付费单，无法原路退款（赠送单请用会员管理调整有效期）" },
      { status: 400 },
    )
  }

  // 先调微信退款，成功后再落库
  const config = await getPaymentConfig()
  const pay = createWxPayFromConfig(config)
  if (!pay) {
    return NextResponse.json({ error: "未配置微信支付，无法原路退款" }, { status: 400 })
  }
  const totalFen = Math.round(Number(order.amount) * 100)
  try {
    await pay.refunds({
      out_trade_no: order.orderNo,
      out_refund_no: `${order.orderNo}-R`,
      amount: { total: totalFen, currency: "CNY", refund: totalFen },
      reason: "管理员操作退款",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "微信退款请求失败"
    return NextResponse.json({ error: `退款失败：${message}` }, { status: 502 })
  }

  // 标记退款 + 按「剩余仍有效订单」重算该会员该产品权益（多次购买/续费后退款也正确）
  await prisma.membershipOrder.update({
    where: { id: order.id },
    data: { status: "REFUNDED", refundedAt: new Date() },
  })
  await revertEntitlementForRefund({
    id: order.id,
    memberId: order.memberId,
    productId: order.productId,
  })

  return NextResponse.json({ ok: true })
}
