import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyVerificationCode } from "@/lib/verification-code"
import { createMemberSession, setMemberSessionCookie } from "@/lib/member-session"
import { getClientIp } from "@/lib/guestbook"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** POST: 校验验证码 → 认领/创建会员 → 种 session cookie。body: { email, code }。 */
export async function POST(request: NextRequest) {
  let body: { email?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const code = body.code?.trim()
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 })
  }
  if (!code) {
    return NextResponse.json({ error: "请输入验证码" }, { status: 400 })
  }

  const result = await verifyVerificationCode(email, code)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // 认领已有会员，或按邮箱新建（后台可预先开通，这里不会重复建号）
  const existing = await prisma.member.findUnique({ where: { email } })
  if (existing?.archivedAt) {
    return NextResponse.json({ error: "该账号已归档，请联系管理员" }, { status: 403 })
  }
  const member = existing ?? await prisma.member.create({ data: { email } })

  // 封禁账号不发 session（被禁会员不应能登录）
  if (member.disabled) {
    return NextResponse.json({ error: "该账号已被封禁，请联系管理员" }, { status: 403 })
  }

  // 建会话并强制设备上限（最多 2 台，超出踢最久未用），再种 cookie
  const sid = await createMemberSession(member.id, {
    userAgent: request.headers.get("user-agent"),
    ip: getClientIp(request),
  })
  await setMemberSessionCookie(member.id, sid)

  return NextResponse.json({
    ok: true,
    member: {
      id: member.id,
      email: member.email,
      name: member.name,
    },
  })
}
