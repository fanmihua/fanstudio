import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getClientIp } from "@/lib/guestbook"

export const dynamic = "force-dynamic"

/** 轮询限流：同一 IP 每分钟最多 60 次（前端每 3 秒一次，单订单约 20 次/分，留足余量）。 */
const pollRateState = globalThis as typeof globalThis & {
  __orderPollRate?: Map<string, { count: number; windowStart: number }>
}
function pollRateOk(ip: string): boolean {
  const now = Date.now()
  const WINDOW = 60_000
  const MAX = 60
  if (!pollRateState.__orderPollRate) pollRateState.__orderPollRate = new Map()
  const m = pollRateState.__orderPollRate
  const s = m.get(ip)
  if (!s || now - s.windowStart >= WINDOW) {
    m.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (s.count >= MAX) return false
  s.count += 1
  return true
}

/** GET: 凭不可枚举的订单 id（cuid）查询支付状态，前端轮询用。
 *  用 id 而非可枚举的 orderNo 作凭证——防止他人凭猜到的单号领取交付链接。 */
export async function GET(request: NextRequest) {
  if (!pollRateOk(getClientIp(request))) {
    return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429 })
  }

  const id = new URL(request.url).searchParams.get("id")?.trim()
  if (!id) {
    return NextResponse.json({ error: "缺少订单凭证" }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      work: { select: { figmaUrl: true, deliveryUrl: true } },
      version: { select: { figmaUrl: true, deliveryUrl: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 })
  }

  const figmaUrl = order.version?.figmaUrl ?? order.work?.figmaUrl ?? null
  const deliveryUrl = order.version?.deliveryUrl ?? order.work?.deliveryUrl ?? null

  return NextResponse.json({
    status: order.status,
    figmaUrl: order.status === "PAID" ? figmaUrl : null,
    deliveryUrl: order.status === "PAID" ? deliveryUrl : null,
  })
}
