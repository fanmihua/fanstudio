/**
 * 留言板（来坐坐）服务端工具：
 * - 防滥用：内存限流（按 IP）、链接数量过滤、长度校验、蜜罐由路由处理
 * - 隐私：客户端 IP 仅存哈希，不存明文
 * 纯函数 + 进程内状态，便于在 Route Handler 复用。
 */
import { createHash } from "node:crypto"
import type { NextRequest } from "next/server"

export const MAX_NICKNAME = 60
export const MAX_CONTENT = 1000
const RATE_WINDOW_MS = 60 * 1000
const MAX_PER_WINDOW = 6 // 每个 IP 每分钟最多 6 条
const MAX_LINKS = 2 // 超过则判为广告

type RateState = { count: number; windowStart: number }
const runtime = globalThis as typeof globalThis & {
  __guestbookRate?: Map<string, RateState>
}
function rateMap(): Map<string, RateState> {
  if (!runtime.__guestbookRate) runtime.__guestbookRate = new Map()
  return runtime.__guestbookRate
}

/**
 * 解析客户端真实 IP（部署在 nginx 之后）。
 * - 优先 x-real-ip：nginx 写为 $remote_addr（直连对端=真实客户端），会覆盖客户端自带值，不可伪造。
 * - 回退取 x-forwarded-for 的【最后一段】：即 nginx 追加的 $remote_addr。
 *   绝不取第一段——首段是客户端自带、可任意伪造的值，取首段会让所有 IP 限流被伪造头绕过。
 */
export function getClientIp(request: NextRequest): string {
  return clientIpFromHeaders(request.headers)
}

/** 同 getClientIp，但接受裸 Headers（供 NextAuth authorize 等拿不到 NextRequest 的场景复用）。 */
export function clientIpFromHeaders(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return "unknown"
}

/** IP 哈希（sha256，截断），用于防滥用统计而不落明文。 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`guestbook:${ip}`).digest("hex").slice(0, 64)
}

/** 内存滑动窗口限流。 */
export function checkRate(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const map = rateMap()
  const state = map.get(key)
  if (!state || now - state.windowStart >= RATE_WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now })
    return { ok: true, retryAfter: 0 }
  }
  if (state.count >= MAX_PER_WINDOW) {
    const retryAfterMs = RATE_WINDOW_MS - (now - state.windowStart)
    return { ok: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) }
  }
  state.count += 1
  map.set(key, state)
  return { ok: true, retryAfter: 0 }
}

/** 粗略统计链接数量（http(s)://、www.、常见 TLD 裸域名）。 */
export function countLinks(text: string): number {
  const matches = text.match(
    /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|cn|org|io|xyz|top|vip|shop|info|biz|club|online|site|live)\b/gi,
  )
  return matches ? matches.length : 0
}

export type ValidatedMessage =
  | { ok: true; nickname: string | null; content: string }
  | { ok: false; error: string }

/** 校验昵称 + 内容（中文报错文案，前台直接展示）。 */
export function validateMessage(rawNickname: unknown, rawContent: unknown): ValidatedMessage {
  const content = typeof rawContent === "string" ? rawContent.trim() : ""
  if (!content) return { ok: false, error: "留言内容不能为空" }
  if (content.length > MAX_CONTENT) return { ok: false, error: `留言不能超过 ${MAX_CONTENT} 字哦` }
  if (countLinks(content) > MAX_LINKS) return { ok: false, error: "留言里链接太多啦，发不出去哦" }

  let nickname: string | null = typeof rawNickname === "string" ? rawNickname.trim() : ""
  if (nickname && nickname.length > MAX_NICKNAME) nickname = nickname.slice(0, MAX_NICKNAME)
  if (!nickname) nickname = null

  return { ok: true, nickname, content }
}
