import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentMember } from "@/lib/require-member"
import { checkRouteRateLimit, rateLimitJson } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** GET: ?orderNo= 查会员订单状态（供扫码后前台轮询）。
 *  只返回支付状态，不回传金额/套餐名，避免凭单号关联出订单明细。 */
export async function GET(request: NextRequest) {
  const ipLimit = checkRouteRateLimit(request, { namespace: "mbr-status-ip", limit: 80, windowMs: 60_000 })
  if (!ipLimit.ok) return rateLimitJson(ipLimit.retryAfter)

  const member = await getCurrentMember()
  if (!member || member.disabled) return NextResponse.json({ error: "请先登录" }, { status: 401 })

  const orderNo = new URL(request.url).searchParams.get("orderNo")?.trim()
  if (!orderNo) {
    return NextResponse.json({ error: "缺少 orderNo" }, { status: 400 })
  }
  const order = await prisma.membershipOrder.findUnique({
    where: { orderNo },
    select: { memberId: true, status: true },
  })
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }
  if (order.memberId !== member.id) {
    return NextResponse.json({ error: "无权查看该订单" }, { status: 403 })
  }
  return NextResponse.json({ status: order.status })
}
