import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import prisma from "@/lib/prisma"
import { logMembershipEvent } from "@/lib/membership-events"
import { getPaymentConfig } from "@/lib/payment-config"
import { getCurrentMember } from "@/lib/require-member"
import { checkRouteRateLimit, rateLimitJson } from "@/lib/rate-limit"
import { createWxPayFromConfig } from "@/lib/wechatpay"

export const dynamic = "force-dynamic"

/** POST: 会员订单微信 Native 下单。body: { orderNo }，返回 code_url + 二维码 data URL。 */
export async function POST(request: NextRequest) {
  const ipLimit = checkRouteRateLimit(request, { namespace: "mbr-pay-ip", limit: 30, windowMs: 60_000 })
  if (!ipLimit.ok) return rateLimitJson(ipLimit.retryAfter)

  const member = await getCurrentMember()
  if (!member || member.disabled) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }
  const memberLimit = checkRouteRateLimit(request, {
    namespace: "mbr-pay-member",
    key: member.id,
    limit: 12,
    windowMs: 60_000,
  })
  if (!memberLimit.ok) return rateLimitJson(memberLimit.retryAfter)

  let body: { orderNo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const orderNo = body.orderNo?.trim()
  if (!orderNo) {
    return NextResponse.json({ error: "缺少 orderNo" }, { status: 400 })
  }

  const order = await prisma.membershipOrder.findUnique({ where: { orderNo } })
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }
  if (order.memberId !== member.id || order.source !== "PURCHASE") {
    return NextResponse.json({ error: "无权操作该订单" }, { status: 403 })
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "订单状态不是待支付" }, { status: 400 })
  }

  const config = await getPaymentConfig()
  const baseNotify = config.wechatNotifyUrl?.trim()
  if (!baseNotify) {
    void logMembershipEvent({
      type: "PAY_QR_FAILED",
      level: "ERROR",
      message: "会员支付下单失败：未配置支付回调地址",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
    })
    return NextResponse.json({ error: "未配置支付回调地址" }, { status: 500 })
  }
  // 复用已配置的回调域名，路径换成会员回调
  let notifyUrl: string
  try {
    notifyUrl = new URL("/api/membership/notify", baseNotify).toString()
  } catch {
    void logMembershipEvent({
      type: "PAY_QR_FAILED",
      level: "ERROR",
      message: "会员支付下单失败：回调地址配置异常",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
      metadata: { baseNotify },
    })
    return NextResponse.json({ error: "回调地址配置异常" }, { status: 500 })
  }

  const pay = createWxPayFromConfig(config)
  if (!pay) {
    void logMembershipEvent({
      type: "PAY_QR_FAILED",
      level: "ERROR",
      message: "会员支付下单失败：微信支付配置不完整",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
    })
    return NextResponse.json(
      { error: "微信支付未配置完整（AppID、商户号、证书、私钥）" },
      { status: 500 },
    )
  }

  const amountCents = Math.round(Number(order.amount) * 100)
  if (amountCents <= 0) {
    void logMembershipEvent({
      type: "PAY_QR_FAILED",
      level: "ERROR",
      message: "会员支付下单失败：订单金额异常",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
      metadata: { amount: Number(order.amount) },
    })
    return NextResponse.json({ error: "订单金额异常" }, { status: 400 })
  }

  const description = `会员 · ${order.planName}`.slice(0, 127)

  try {
    const result = await pay.transactions_native({
      description,
      out_trade_no: orderNo,
      notify_url: notifyUrl,
      amount: { total: amountCents, currency: "CNY" },
    })
    const output = result as {
      status?: number
      code_url?: string
      data?: { code_url?: string }
      code?: string
      message?: string
    }
    const codeUrl = output.data?.code_url || output.code_url
    if (output.status === 200 && codeUrl) {
      const qrDataUrl = await QRCode.toDataURL(codeUrl, {
        width: 260,
        margin: 1,
        color: { dark: "#0a0a0a", light: "#ffffff" },
      })
      void logMembershipEvent({
        type: "PAY_QR_CREATED",
        message: "会员支付二维码创建成功",
        orderId: order.id,
        orderNo: order.orderNo,
        memberId: order.memberId,
        productId: order.productId,
        email: order.buyerEmail,
        metadata: { amount: Number(order.amount), planName: order.planName },
      })
      return NextResponse.json({ code_url: codeUrl, qr_data_url: qrDataUrl })
    }
    void logMembershipEvent({
      type: "PAY_QR_FAILED",
      level: "ERROR",
      message: "会员微信 Native 下单失败",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
      metadata: {
        status: output.status ?? null,
        code: output.code ?? null,
        message: output.message ?? null,
      },
    })
    return NextResponse.json(
      { error: output.message || output.code || "微信下单失败" },
      { status: 502 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "微信下单异常"
    void logMembershipEvent({
      type: "PAY_QR_FAILED",
      level: "ERROR",
      message: "会员微信 Native 下单异常",
      orderId: order.id,
      orderNo: order.orderNo,
      memberId: order.memberId,
      productId: order.productId,
      email: order.buyerEmail,
      metadata: { error: message },
    })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
