import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getPaymentConfig } from "@/lib/payment-config"
import { getNotifyConfig } from "@/lib/wechatpay"
import { applyPaidMembershipOrder } from "@/lib/membership"
import { logMembershipEvent } from "@/lib/membership-events"
import { sendMembershipEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"
import { validateWechatPaidAmount, type WechatPaidAmount } from "@/lib/wechat-payment-amount"

export const dynamic = "force-dynamic"

/** POST: 会员订单微信支付回调。解密验证 → 标 PAID + 授予会员权限 → 发回执邮件。 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!rawBody) {
    return NextResponse.json({ code: "FAIL", message: "空报文" }, { status: 400 })
  }

  const config = await getPaymentConfig()
  const notifyConfig = getNotifyConfig(config)
  if (!notifyConfig) {
    return NextResponse.json({ code: "FAIL", message: "商户未配置" }, { status: 500 })
  }
  const { key, pay } = notifyConfig

  let eventBody: {
    event_type?: string
    resource?: { ciphertext: string; associated_data: string; nonce: string }
  }
  try {
    eventBody = JSON.parse(rawBody) as typeof eventBody
  } catch {
    return NextResponse.json({ code: "FAIL", message: "JSON 解析失败" }, { status: 400 })
  }

  const resource = eventBody?.resource
  if (!resource?.ciphertext || !resource.associated_data || !resource.nonce) {
    return NextResponse.json({ code: "FAIL", message: "缺少 resource" }, { status: 400 })
  }

  let decrypted: { out_trade_no?: string; transaction_id?: string; trade_state?: string; amount?: WechatPaidAmount }
  try {
    decrypted = pay.decipher_gcm<typeof decrypted>(
      resource.ciphertext,
      resource.associated_data,
      resource.nonce,
      key,
    )
  } catch {
    return NextResponse.json({ code: "FAIL", message: "解密失败，报文不可信" }, { status: 401 })
  }

  const outTradeNo = decrypted.out_trade_no?.trim()
  if (!outTradeNo) {
    return NextResponse.json({ code: "FAIL", message: "缺少商户订单号" }, { status: 400 })
  }
  if (decrypted.trade_state !== "SUCCESS") {
    void logMembershipEvent({
      type: "PAYMENT_NOTIFY_IGNORED",
      level: "WARN",
      message: "忽略非成功状态的会员支付回调",
      orderNo: outTradeNo,
      metadata: {
        tradeState: decrypted.trade_state ?? null,
        transactionId: decrypted.transaction_id ?? null,
      },
    })
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }

  const order = await prisma.membershipOrder.findUnique({ where: { orderNo: outTradeNo } })
  if (!order) {
    void logMembershipEvent({
      type: "PAYMENT_NOTIFY_RECEIVED",
      level: "ERROR",
      message: "收到会员支付成功回调，但订单不存在",
      orderNo: outTradeNo,
      metadata: { transactionId: decrypted.transaction_id ?? null },
    })
    return NextResponse.json({ code: "FAIL", message: "订单不存在" }, { status: 404 })
  }
  void logMembershipEvent({
    type: "PAYMENT_NOTIFY_RECEIVED",
    message: "收到会员支付成功回调",
    orderId: order.id,
    orderNo: order.orderNo,
    memberId: order.memberId,
    productId: order.productId,
    email: order.buyerEmail,
    metadata: {
      transactionId: decrypted.transaction_id ?? null,
      amount: decrypted.amount ?? null,
    },
  })
  const amountCheck = validateWechatPaidAmount(Number(order.amount), decrypted.amount)
  if (!amountCheck.ok) {
    void logMembershipEvent({
      type: "PAYMENT_AMOUNT_MISMATCH",
      level: "ERROR",
      message: "会员支付回调金额校验失败",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
      metadata: {
        expectedYuan: Number(order.amount),
        paidAmount: decrypted.amount ?? null,
        error: amountCheck.error,
      },
    })
    return NextResponse.json({ code: "FAIL", message: amountCheck.error }, { status: 400 })
  }

  const res = await applyPaidMembershipOrder(outTradeNo, decrypted.transaction_id ?? null)
  if (!res.ok) {
    void logMembershipEvent({
      type: "PAYMENT_NOTIFY_IGNORED",
      level: res.reason === "not_found" ? "ERROR" : "WARN",
      message: "会员支付回调未完成权益开通",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
      metadata: { reason: res.reason, transactionId: decrypted.transaction_id ?? null },
    })
    // 订单不存在 → 让微信重试；其它（已取消/无会员）视为终态，直接 ACK
    if (res.reason === "not_found") {
      return NextResponse.json({ code: "FAIL", message: "订单不存在" }, { status: 404 })
    }
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }

  void logMembershipEvent({
    type: res.newlyPaid ? "PAYMENT_APPLIED" : "PAYMENT_DUPLICATE",
    message: res.newlyPaid ? "会员支付已开通权益" : "重复会员支付回调已幂等处理",
    orderId: res.order.id,
    orderNo: res.order.orderNo,
    memberId: res.order.memberId,
    productId: res.order.productId,
    email: res.order.buyerEmail,
    metadata: {
      transactionId: decrypted.transaction_id ?? null,
      isRenewal: res.isRenewal,
      isLifetime: res.entitlement?.isLifetime ?? null,
      expiresAt: res.entitlement?.expiresAt?.toISOString() ?? null,
    },
  })

  if (res.newlyPaid) {
    const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { siteName: true } })
    const product = await prisma.product.findUnique({ where: { id: res.order.productId }, select: { name: true, landingPath: true } })
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || ""
    const startUrl = siteUrl && product?.landingPath ? `${siteUrl}${product.landingPath}` : null
    sendMembershipEmail({
      to: res.order.buyerEmail,
      siteName: normalizeSiteName(settings?.siteName),
      productName: product?.name ?? res.order.planName,
      source: "PURCHASE",
      isRenewal: res.isRenewal,
      isLifetime: res.entitlement?.isLifetime ?? false,
      isLifetimeOrder: res.order.isLifetime,
      accessUntil: res.entitlement?.expiresAt ?? null,
      amount: Number(res.order.amount),
      planName: res.order.planName,
      note: res.order.note,
      startUrl,
    }).catch(() => {})
  }

  return NextResponse.json({ code: "SUCCESS", message: "成功" })
}
