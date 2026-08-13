/**
 * 会员（顾客）session：自签 httpOnly cookie + 服务端会话记录（多设备限制）。
 * token = `<base64url(payload)>.<base64url(hmac)>`，payload = { memberId, sid, exp }；sid 指向 MemberSession 行。
 * 每账号最多 MAX_DEVICES 台同时在线；新登录超出则踢「最久未用」(lastSeenAt 最早) 的那台。
 * 与后台管理员 NextAuth 完全隔离。中间件 proxy.ts 不引入本文件，故可安全使用 prisma。
 *
 * 签名密钥取 MEMBER_SESSION_SECRET，回退到 AUTH_SECRET / NEXTAUTH_SECRET。
 */
import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"
import prisma from "@/lib/prisma"

export const MEMBER_COOKIE_NAME = "member_session"
const DEFAULT_TTL_DAYS = 30
const MAX_DEVICES = 2 // 同账号最多同时在线设备数
const SEEN_THROTTLE_MS = 10 * 60 * 1000 // lastSeenAt 最多每 10 分钟更新一次（省写）

function getSecret(): string {
  const s =
    process.env.MEMBER_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET
  if (!s) {
    throw new Error(
      "缺少会员 session 签名密钥：请设置 MEMBER_SESSION_SECRET 或 AUTH_SECRET",
    )
  }
  return s
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url")
}

export interface MemberSessionPayload {
  memberId: string
  sid: string // 对应 MemberSession.id
  exp: number // 过期时间（epoch 秒）
}

/** 生成签名 token。 */
export function createMemberSessionToken(
  memberId: string,
  sid: string,
  ttlDays = DEFAULT_TTL_DAYS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400
  const payload = Buffer.from(
    JSON.stringify({ memberId, sid, exp } satisfies MemberSessionPayload),
  ).toString("base64url")
  return `${payload}.${sign(payload)}`
}

/** 校验 token，返回 payload；签名不符 / 过期 / 格式错（含旧版无 sid）均返回 null。 */
export function verifyMemberSessionToken(
  token: string | undefined | null,
): MemberSessionPayload | null {
  if (!token) return null
  const dot = token.indexOf(".")
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as MemberSessionPayload
    if (!data?.memberId || !data?.sid || typeof data.exp !== "number") return null
    if (data.exp * 1000 < Date.now()) return null
    return data
  } catch {
    return null
  }
}

/**
 * 新建登录会话并强制设备上限。返回 sid（写进 cookie token）。
 * 顺手清理本人已过期会话；保留最近活跃的 MAX_DEVICES 台（含刚建的），其余「最久未用」删除。
 */
export async function createMemberSession(
  memberId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<string> {
  const now = Date.now()
  await prisma.memberSession.deleteMany({ where: { memberId, expiresAt: { lt: new Date(now) } } })
  const session = await prisma.memberSession.create({
    data: {
      memberId,
      userAgent: meta.userAgent ? meta.userAgent.slice(0, 255) : null,
      ip: meta.ip ?? null,
      expiresAt: new Date(now + ttlDays * 86400_000),
    },
  })
  const all = await prisma.memberSession.findMany({
    where: { memberId },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true },
  })
  if (all.length > MAX_DEVICES) {
    const evict = all.slice(MAX_DEVICES).map((s) => s.id) // 最久未用的若干台
    await prisma.memberSession.deleteMany({ where: { id: { in: evict } } })
  }
  return session.id
}

/** 写入会员 session cookie（httpOnly）。sid 由 createMemberSession 提供。 */
export async function setMemberSessionCookie(
  memberId: string,
  sid: string,
  ttlDays = DEFAULT_TTL_DAYS,
): Promise<void> {
  const token = createMemberSessionToken(memberId, sid, ttlDays)
  const store = await cookies()
  store.set(MEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttlDays * 86400,
  })
}

/** 清除会员 session cookie 并删除对应服务端会话（登出）。 */
export async function clearMemberSessionCookie(): Promise<void> {
  const store = await cookies()
  const token = store.get(MEMBER_COOKIE_NAME)?.value
  const payload = verifyMemberSessionToken(token)
  if (payload?.sid) {
    await prisma.memberSession.deleteMany({ where: { id: payload.sid } }).catch(() => {})
  }
  store.set(MEMBER_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 })
}

/**
 * 读 cookie → 验签 → 校验服务端会话仍存在且未过期（被踢 / 登出 / 过期即失效）→ 返回 memberId。
 * 命中后节流更新 lastSeenAt（用于「最久未用」判定）。
 */
export async function getMemberIdFromCookie(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(MEMBER_COOKIE_NAME)?.value
  const payload = verifyMemberSessionToken(token)
  if (!payload) return null
  const session = await prisma.memberSession
    .findUnique({ where: { id: payload.sid } })
    .catch(() => null)
  if (!session || session.memberId !== payload.memberId || session.expiresAt.getTime() < Date.now()) {
    return null // 会话已被踢下线 / 登出 / 过期
  }
  if (Date.now() - session.lastSeenAt.getTime() > SEEN_THROTTLE_MS) {
    await prisma.memberSession
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {})
  }
  return payload.memberId
}
