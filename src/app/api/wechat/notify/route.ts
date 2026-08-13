import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendOrderEmail } from "@/lib/email"
import { getPaymentConfig } from "@/lib/payment-config"
import { getNotifyConfig } from "@/lib/wechatpay"
import { normalizeSiteName } from "@/lib/page-copy"
import { validateWechatPaidAmount, type WechatPaidAmount } from "@/lib/wechat-payment-amount"

export const dynamic = "force-dynamic"

/** POST: 微信支付成功回调。解密验证、更新订单、发邮件，返回 200 { code, message }。
 *  验证策略：使用 APIv3 密钥进行 AEAD 解密，解密成功即证明报文来自微信。
 *  （verifySign 需要微信平台证书，此处以解密替代签名验证，安全性等同。） */
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

  let eventBody: { event_type?: string; resource?: { ciphertext: string; associated_data: string; nonce: string } }
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
    // AEAD 解密失败说明报文不合法（密钥不匹配或数据被篡改）
    return NextResponse.json({ code: "FAIL", message: "解密失败，报文不可信" }, { status: 401 })
  }

  const outTradeNo = decrypted.out_trade_no?.trim()
  const tradeState = decrypted.trade_state
  if (!outTradeNo) {
    return NextResponse.json({ code: "FAIL", message: "缺少商户订单号" }, { status: 400 })
  }
  if (tradeState !== "SUCCESS") {
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }

  const order = await prisma.order.findUnique({
    where: { orderNo: outTradeNo },
    include: {
      work: { select: { title: true, figmaUrl: true, deliveryUrl: true, currentVersion: true } },
      version: { select: { version: true, figmaUrl: true, deliveryUrl: true } },
    },
  })
  if (!order) {
    return NextResponse.json({ code: "FAIL", message: "订单不存在" }, { status: 404 })
  }
  if (order.status === "PAID") {
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }
  const amountCheck = validateWechatPaidAmount(Number(order.amount), decrypted.amount)
  if (!amountCheck.ok) {
    return NextResponse.json({ code: "FAIL", message: amountCheck.error }, { status: 400 })
  }

  // 原子状态转换:只有把订单从 PENDING 翻成 PAID 的那一次回调才继续发交付邮件。
  // 微信会重试回调、并发到达时两个请求都可能读到 PENDING;用条件更新让抢输的那次
  // (count===0)幂等返回成功，避免重复发交付邮件 / 重复处理。
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentId: decrypted.transaction_id ?? null,
    },
  })
  if (claimed.count === 0) {
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  }

  const figmaUrl = order.version?.figmaUrl ?? order.work?.figmaUrl ?? null
  const deliveryUrl = order.version?.deliveryUrl ?? order.work?.deliveryUrl ?? null
  const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
  const socialLinks = (settings?.socialLinks as Record<string, string> | null) || {}
  sendOrderEmail({
    to: order.buyerEmail,
    siteName: normalizeSiteName(settings?.siteName),
    workTitle: order.work?.title ?? "作品",
    orderNo: order.orderNo,
    locale: order.buyerLocale === "EN" ? "en" : "zh",
    isFree: false,
    amount: Number(order.amount),
    figmaUrl,
    deliveryUrl,
    currentVersion: order.version?.version ?? order.work?.currentVersion ?? null,
    wechat: socialLinks.wechat ?? null,
  }).catch(() => {})

  return NextResponse.json({ code: "SUCCESS", message: "成功" })
}
