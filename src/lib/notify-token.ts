/**
 * 更新提醒邮件「一键退订」链接的签名 token（免登录）。
 * token = base64url(memberId) + "." + hmac(memberId)；密钥与会员 session 同源。
 * 无过期时间：退订链接长期有效（行业惯例），且仅能做「关提醒」这一件低风险的事。
 */
import { createHmac, timingSafeEqual } from "crypto"

function getSecret(): string {
  const s =
    process.env.MEMBER_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET
  if (!s) {
    throw new Error("缺少签名密钥：请设置 MEMBER_SESSION_SECRET 或 AUTH_SECRET")
  }
  return s
}

function sign(memberId: string): string {
  return createHmac("sha256", getSecret()).update(`notify-unsub:${memberId}`).digest("base64url")
}

export function signNotifyToken(memberId: string): string {
  return `${Buffer.from(memberId, "utf8").toString("base64url")}.${sign(memberId)}`
}

/** 校验 token，返回 memberId；签名不符 / 格式错返回 null。 */
export function verifyNotifyToken(token: string | null | undefined): string | null {
  if (!token) return null
  const dot = token.indexOf(".")
  if (dot <= 0) return null
  let memberId: string
  try {
    memberId = Buffer.from(token.slice(0, dot), "base64url").toString("utf8")
  } catch {
    return null
  }
  if (!memberId) return null
  const a = Buffer.from(token.slice(dot + 1))
  const b = Buffer.from(sign(memberId))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return memberId
}
