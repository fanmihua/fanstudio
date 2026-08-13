import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getClientIp } from "@/lib/guestbook"
import { issueVerificationCode, CODE_TTL_MINUTES } from "@/lib/verification-code"
import { sendVerificationCodeEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

/** IP 限流：每分钟最多 5 次发码，挡轰炸。 */
const rateState = globalThis as typeof globalThis & {
  __memberCodeRate?: Map<string, { count: number; windowStart: number }>
}
function rateOk(ip: string): boolean {
  const now = Date.now()
  const WINDOW = 60_000
  const MAX = 5
  if (!rateState.__memberCodeRate) rateState.__memberCodeRate = new Map()
  const m = rateState.__memberCodeRate
  const s = m.get(ip)
  if (!s || now - s.windowStart >= WINDOW) {
    m.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (s.count >= MAX) return false
  s.count += 1
  return true
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** POST: 发送邮箱登录验证码。body: { email }。 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  if (!rateOk(ip)) {
    return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429 })
  }

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 })
  }

  const issued = await issueVerificationCode(email)
  if (!issued.ok) {
    return NextResponse.json(
      { error: issued.error, retryAfter: issued.retryAfter },
      { status: 429 },
    )
  }

  const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
  // 实际发邮件（未配置 SMTP 会静默跳过）；是否送达不影响下面的 dev 回显
  await sendVerificationCodeEmail({
    to: email,
    siteName: normalizeSiteName(settings?.siteName),
    code: issued.code,
    ttlMinutes: CODE_TTL_MINUTES,
  })

  // 开发环境一律回显验证码，便于本地联调（不依赖邮箱是否送达）；生产绝不回显。
  const devCode = process.env.NODE_ENV !== "production" ? issued.code : undefined

  return NextResponse.json({
    ok: true,
    ttlMinutes: CODE_TTL_MINUTES,
    ...(devCode ? { devCode } : {}),
  })
}
