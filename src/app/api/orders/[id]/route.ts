import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { sendOrderEmail, sendRefundEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"
import { getPaymentConfig } from "@/lib/payment-config"
import { createWxPayFromConfig } from "@/lib/wechatpay"

export const dynamic = "force-dynamic"

/** GET: 管理员查看订单详情。仅 ADMIN 可访问，VIEWER 返回 403。 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: { work: { select: { id: true, title: true, fileName: true } } },
  })
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }
  return NextResponse.json({
    ...order,
    amount: Number(order.amount),
  })
}

/** PUT: 管理员更新订单状态。body: { status }。PENDING→PAID|CANCELLED；PAID→REFUNDED；CANCELLED/REFUNDED 为终态。 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:   ["PAID", "CANCELLED"],
  PAID:      ["REFUNDED"],
  CANCELLED: [],
  REFUNDED:  [],
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  const body = await request.json()
  const { status } = body

  const validStatuses = ["PENDING", "PAID", "CANCELLED", "REFUNDED"]
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "无效的状态" }, { status: 400 })
  }

  const existing = await prisma.order.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }

  // 状态转换验证
  const allowed = VALID_TRANSITIONS[existing.status] || []
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `不允许从「${existing.status}」转换到「${status}」` },
      { status: 400 },
    )
  }

  // 退款：先调用微信退款 API，成功后再更新订单并发邮件
  if (status === "REFUNDED") {
    const config = await getPaymentConfig()
    const pay = createWxPayFromConfig(config)
    if (!pay) {
      return NextResponse.json(
        { error: "未配置微信支付，无法执行原路退款" },
        { status: 400 },
      )
    }
    const amountYuan = Number(existing.amount)
    const totalFen = Math.round(amountYuan * 100)
    const outRefundNo = `${existing.orderNo}-R`
    try {
      await pay.refunds({
        out_trade_no: existing.orderNo,
        out_refund_no: outRefundNo,
        amount: {
          total: totalFen,
          currency: "CNY",
          refund: totalFen,
        },
        reason: "管理员操作退款",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "微信退款请求失败"
      return NextResponse.json(
        { error: `退款失败：${message}` },
        { status: 502 },
      )
    }
  }

  // 如果标记为已支付且没有 downloadToken，则生成一个
  const needsToken = status === "PAID" && !existing.downloadToken
  const token = needsToken ? randomBytes(32).toString("hex") : undefined

  // 退款时清除 downloadToken 并重置 downloadCount
  const isRefund = status === "REFUNDED"

  const order = await prisma.order.update({
    where: { id },
    data: {
      status,
      ...(status === "PAID" && !existing.paidAt && { paidAt: new Date() }),
      ...(token && { downloadToken: token }),
      ...(isRefund && { downloadToken: null, downloadCount: 0 }),
    },
  })

  // 退款成功后发送退款通知邮件
  if (isRefund) {
    const work = await prisma.work.findUnique({
      where: { id: order.workId },
      select: { title: true },
    })
    if (work) {
      const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
      sendRefundEmail({
        to: order.buyerEmail,
        siteName: normalizeSiteName(settings?.siteName),
        workTitle: work.title,
        orderNo: order.orderNo,
        amount: Number(order.amount),
      }).catch(() => {})
    }
  }

  // 管理员手动标记为已支付时发送邮件
  if (status === "PAID" && existing.status === "PENDING") {
    const work = await prisma.work.findUnique({
      where: { id: order.workId },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    if (work) {
      const ver = order.versionId
        ? await prisma.workVersion.findUnique({ where: { id: order.versionId } })
        : work.versions[0] || null
      const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
      const socialLinks = (settings?.socialLinks as Record<string, string> | null) || {}
      sendOrderEmail({
        to: order.buyerEmail,
        siteName: normalizeSiteName(settings?.siteName),
        workTitle: work.title,
        orderNo: order.orderNo,
        isFree: false,
        amount: Number(order.amount),
        figmaUrl: ver?.figmaUrl || work.figmaUrl || null,
        deliveryUrl: ver?.deliveryUrl || work.deliveryUrl || null,
        currentVersion: ver?.version || work.currentVersion,
        wechat: socialLinks.wechat || null,
      }).catch(() => {})
    }
  }

  return NextResponse.json({
    ...order,
    amount: Number(order.amount),
  })
}

/** DELETE: 管理员删除订单（需登录）。仅做数据清理，与支付/退款状态无关。 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  const existing = await prisma.order.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }
  await prisma.order.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
