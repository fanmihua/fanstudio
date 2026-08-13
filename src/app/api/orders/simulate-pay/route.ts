import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { sendOrderEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

/** POST: 模拟支付成功（仅测试用，需管理员登录）。生产环境一律硬 404，杜绝逃逸开关后门。 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { orderNo } = await request.json()

  if (!orderNo) {
    return NextResponse.json({ error: "缺少 orderNo" }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      work: { select: { figmaUrl: true, deliveryUrl: true } },
      version: { select: { version: true, figmaUrl: true, deliveryUrl: true } },
    },
  })
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "订单状态不是待支付" }, { status: 400 })
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  })

  const fUrl = order.version?.figmaUrl || order.work.figmaUrl || null
  const dUrl = order.version?.deliveryUrl || order.work.deliveryUrl || null

  // 异步发送邮件（不阻塞响应）
  const work = await prisma.work.findUnique({
    where: { id: order.workId },
    select: { title: true, isFree: true, currentVersion: true },
  })
  const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
  const socialLinks = (settings?.socialLinks as Record<string, string> | null) || {}
  sendOrderEmail({
    to: order.buyerEmail,
    siteName: normalizeSiteName(settings?.siteName),
    workTitle: work?.title || "作品",
    orderNo: order.orderNo,
    isFree: false,
    amount: Number(order.amount),
    figmaUrl: fUrl,
    deliveryUrl: dUrl,
    currentVersion: order.version?.version || work?.currentVersion,
    wechat: socialLinks.wechat || null,
  }).catch(() => {})

  return NextResponse.json({
    id: order.id,
    orderNo: order.orderNo,
    status: "PAID",
    figmaUrl: fUrl,
    deliveryUrl: dUrl,
  })
}
