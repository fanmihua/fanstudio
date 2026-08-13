import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { getStatConfig, setStatBase } from "@/lib/site-stat"

export const dynamic = "force-dynamic"

/** GET：读统计基数配置 + 真实分量（访问/通行）。 */
export async function GET() {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  return NextResponse.json(await getStatConfig())
}

/** PUT：设访问/通行基数（非负整数）。 */
export async function PUT(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  let body: { baseVisits?: unknown; basePasses?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }
  const bv = Math.floor(Number(body.baseVisits))
  const bp = Math.floor(Number(body.basePasses))
  if (!Number.isFinite(bv) || !Number.isFinite(bp) || bv < 0 || bp < 0) {
    return NextResponse.json({ error: "基数必须是非负整数" }, { status: 400 })
  }
  await setStatBase(bv, bp)
  return NextResponse.json(await getStatConfig())
}
