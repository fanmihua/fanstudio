/** 分享计数 API（轻量）：每次分享动作 +1（不去重，与「分享 X 次」语义一致），IP 限流挡刷。 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getClientIp } from "@/lib/guestbook"

export const dynamic = "force-dynamic"

const TYPES = ["post"] as const
type EntityType = (typeof TYPES)[number]

// IP 限流：每分钟最多 30 次分享动作，挡脚本刷
const rateState = globalThis as typeof globalThis & {
  __shareRate?: Map<string, { count: number; windowStart: number }>
}
function rateOk(ip: string): boolean {
  const now = Date.now()
  const WINDOW = 60 * 1000
  const MAX = 30
  if (!rateState.__shareRate) rateState.__shareRate = new Map()
  const m = rateState.__shareRate
  const s = m.get(ip)
  if (!s || now - s.windowStart >= WINDOW) {
    m.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (s.count >= MAX) return false
  s.count += 1
  return true
}

async function bump(type: EntityType, id: string): Promise<number | null> {
  try {
    if (type === "post") {
      return (
        await prisma.post.update({
          where: { id },
          data: { shareCount: { increment: 1 } },
          select: { shareCount: true },
        })
      ).shareCount
    }
    return null
  } catch {
    return null // 记录不存在等
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateOk(ip)) {
    return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429 })
  }
  const body = await request.json().catch(() => null)
  const type = body?.entityType
  const id = body?.entityId
  if (!TYPES.includes(type) || typeof id !== "string" || !id) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 })
  }
  const count = await bump(type as EntityType, id)
  if (count === null) {
    return NextResponse.json({ error: "内容不存在" }, { status: 404 })
  }
  return NextResponse.json({ count })
}
