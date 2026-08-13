import { NextResponse } from "next/server"
import { clearMemberSessionCookie } from "@/lib/member-session"

export const dynamic = "force-dynamic"

/** POST: 会员登出，清除 session cookie。 */
export async function POST() {
  await clearMemberSessionCookie()
  return NextResponse.json({ ok: true })
}
