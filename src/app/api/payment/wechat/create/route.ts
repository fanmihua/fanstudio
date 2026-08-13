import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import prisma from "@/lib/prisma"
import { getPaymentConfig } from "@/lib/payment-config"
import { createWxPayFromConfig } from "@/lib/wechatpay"
import { checkRouteRateLimit, rateLimitJson } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** POST: 微信 Native 统一下单。body: { orderNo }，返回 code_url 供前端生成二维码。
 *  遗留作品订单为游客邮箱模式（无登录可校验归属），故以 IP 限流挡 orderNo 枚举刷二维码。 */
export async function POST(request: NextRequest) {
  const ipLimit = checkRouteRateLimit(request, { namespace: "wx-pay-ip", limit: 20, windowMs: 60_000 })
  if (!ipLimit.ok) return rateLimitJson(ipLimit.retryAfter)

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

  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      work: { select: { id: true, title: true, figmaUrl: true, deliveryUrl: true } },
      version: { select: { version: true, figmaUrl: true, deliveryUrl: true } },
    },
  })
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "订单状态不是待支付" }, { status: 400 })
  }

  const config = await getPaymentConfig()
  const notifyUrl = config.wechatNotifyUrl?.trim()
  if (!notifyUrl) {
    return NextResponse.json({ error: "未配置支付回调地址" }, { status: 500 })
  }

  const pay = createWxPayFromConfig(config)
  if (!pay) {
    return NextResponse.json(
      { error: "微信支付未配置完整（AppID、商户号、证书、私钥）" },
      { status: 500 },
    )
  }

  const amountCents = Math.round(Number(order.amount) * 100)
  if (amountCents <= 0) {
    return NextResponse.json({ error: "订单金额异常" }, { status: 400 })
  }

  const description = order.work?.title
    ? `${order.work.title}${order.version ? ` V${order.version.version}` : ""}`
    : "作品赞助"
  const safeDesc = description.slice(0, 127)

  try {
    const result = await pay.transactions_native({
      description: safeDesc,
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
      return NextResponse.json({ code_url: codeUrl, qr_data_url: qrDataUrl })
    }
    return NextResponse.json(
      { error: output.message || output.code || "微信下单失败" },
      { status: 502 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "微信下单异常"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
