import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { applyPaidMembershipOrder } from "@/lib/membership"
import { sendMembershipEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

/** POST(dev only): 模拟会员订单支付成功，便于无微信环境下本地联调。生产环境 404。 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 })
  }

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

  const res = await applyPaidMembershipOrder(orderNo, "SIMULATED")
  if (!res.ok) {
    return NextResponse.json({ error: `处理失败：${res.reason}` }, { status: 400 })
  }

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

  return NextResponse.json({ ok: true, status: "PAID" })
}
