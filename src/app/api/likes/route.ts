/** 点赞 API（轻量）：±1 计数，IP 限流，不建表；前端用 localStorage 记忆是否已赞。 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getClientIp } from "@/lib/guestbook"

export const dynamic = "force-dynamic"

const TYPES = ["post", "work", "tutorial"] as const
type EntityType = (typeof TYPES)[number]

// IP 限流：每分钟最多 40 次点赞动作，挡脚本刷
const rateState = globalThis as typeof globalThis & {
  __likeRate?: Map<string, { count: number; windowStart: number }>
}
function rateOk(ip: string): boolean {
  const now = Date.now()
  const WINDOW = 60 * 1000
  const MAX = 40
  if (!rateState.__likeRate) rateState.__likeRate = new Map()
  const m = rateState.__likeRate
  const s = m.get(ip)
  if (!s || now - s.windowStart >= WINDOW) {
    m.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (s.count >= MAX) return false
  s.count += 1
  return true
}

async function bump(type: EntityType, id: string, delta: 1 | -1): Promise<number | null> {
  const data = { likeCount: { increment: delta } }
  try {
    if (delta === 1) {
      if (type === "post") return (await prisma.post.update({ where: { id }, data, select: { likeCount: true } })).likeCount
      if (type === "work") return (await prisma.work.update({ where: { id }, data, select: { likeCount: true } })).likeCount
      return (await prisma.videoTutorial.update({ where: { id }, data, select: { likeCount: true } })).likeCount
    }
    // 取消赞：仅在 likeCount>0 时 -1，避免被刷成负数
    if (type === "post") {
      await prisma.post.updateMany({ where: { id, likeCount: { gt: 0 } }, data })
      return (await prisma.post.findUnique({ where: { id }, select: { likeCount: true } }))?.likeCount ?? null
    }
    if (type === "work") {
      await prisma.work.updateMany({ where: { id, likeCount: { gt: 0 } }, data })
      return (await prisma.work.findUnique({ where: { id }, select: { likeCount: true } }))?.likeCount ?? null
    }
    await prisma.videoTutorial.updateMany({ where: { id, likeCount: { gt: 0 } }, data })
    return (await prisma.videoTutorial.findUnique({ where: { id }, select: { likeCount: true } }))?.likeCount ?? null
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
  const action = body?.action === "unlike" ? "unlike" : "like"
  if (!TYPES.includes(type) || typeof id !== "string" || !id) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 })
  }
  const count = await bump(type as EntityType, id, action === "like" ? 1 : -1)
  if (count === null) {
    return NextResponse.json({ error: "内容不存在" }, { status: 404 })
  }
  return NextResponse.json({ count })
}
