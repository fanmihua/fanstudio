import { NextRequest, NextResponse } from "next/server"
import { recordUniqueVisit, getSiteStats } from "@/lib/site-stat"

export const dynamic = "force-dynamic"

// 上线后使用新的 cookie 名，避免测试阶段残留的 sv=1 让正式访问无法重新计数。
const VISIT_COOKIE = "fanstudio_visit_v1"
const ONE_YEAR = 60 * 60 * 24 * 365

/** GET：只读展示数 { visits, passes }（不计数）。 */
export async function GET() {
  return NextResponse.json(await getSiteStats())
}

/**
 * POST：按设备 cookie 去重——仅新访客 +1（同一人刷新/返回不再变，数字更可信），返回最新 { visits, passes }。
 * 徽标挂载时调一次。
 */
export async function POST(request: NextRequest) {
  const seen = request.cookies.get(VISIT_COOKIE)?.value === "1"
  if (!seen) await recordUniqueVisit()
  const stats = await getSiteStats()
  const res = NextResponse.json(stats)
  if (!seen) {
    res.cookies.set(VISIT_COOKIE, "1", { maxAge: ONE_YEAR, httpOnly: true, sameSite: "lax", path: "/" })
  }
  return res
}
