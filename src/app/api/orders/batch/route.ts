import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { getPaymentConfig } from "@/lib/payment-config"
import { createWxPayFromConfig } from "@/lib/wechatpay"
import { sendRefundEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

/** PATCH: 批量更新订单状态。body: { ids, status }，status 为 PAID/CANCELLED/REFUNDED，需管理员登录。 */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { ids, status } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  if (!["PAID", "CANCELLED", "REFUNDED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  // 批量退款需逐笔调用微信退款 API
  if (status === "REFUNDED") {
    return handleBatchRefund(ids)
  }

  const data: Record<string, unknown> = { status }
  if (status === "PAID") data.paidAt = new Date()
  await prisma.order.updateMany({
    where: { id: { in: ids } },
    data,
  })
  return NextResponse.json({ ok: true })
}

/** 逐笔调用微信退款 API 并更新订单状态、发送退款邮件。 */
async function handleBatchRefund(ids: string[]) {
  const config = await getPaymentConfig()
  const pay = createWxPayFromConfig(config)
  if (!pay) {
    return NextResponse.json(
      { error: "未配置微信支付，无法执行原路退款" },
      { status: 400 },
    )
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, status: "PAID" },
    include: { work: { select: { title: true } } },
  })
  if (orders.length === 0) {
    return NextResponse.json(
      { error: "没有符合退款条件的订单（仅已支付可退款）" },
      { status: 400 },
    )
  }

  const results: { orderNo: string; success: boolean; error?: string }[] = []
  const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
  const siteName = normalizeSiteName(settings?.siteName)

  for (const order of orders) {
    const totalFen = Math.round(Number(order.amount) * 100)
    const outRefundNo = `${order.orderNo}-R`
    try {
      await pay.refunds({
        out_trade_no: order.orderNo,
        out_refund_no: outRefundNo,
        amount: { total: totalFen, currency: "CNY", refund: totalFen },
        reason: "管理员批量退款",
      })
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED", downloadToken: null, downloadCount: 0 },
      })
      sendRefundEmail({
        to: order.buyerEmail,
        siteName,
        workTitle: order.work?.title ?? "作品",
        orderNo: order.orderNo,
        amount: Number(order.amount),
      }).catch(() => {})
      results.push({ orderNo: order.orderNo, success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "微信退款请求失败"
      results.push({ orderNo: order.orderNo, success: false, error: message })
    }
  }

  const failed = results.filter((r) => !r.success)
  if (failed.length > 0) {
    return NextResponse.json(
      { ok: false, results, error: `${failed.length} 笔退款失败` },
      { status: 207 },
    )
  }
  return NextResponse.json({ ok: true, results })
}

/** DELETE: 批量删除订单。body: { ids }，需管理员登录。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const body = await request.json()
  const ids = body?.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 })
  }
  await prisma.order.deleteMany({ where: { id: { in: ids } } })
  return NextResponse.json({ ok: true })
}
