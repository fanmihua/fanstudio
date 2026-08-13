import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import {
  deleteExpiredUnreferencedMedia,
  getMediaCleanupReport,
  reconcileMediaCleanup,
  runMediaCleanupCycle,
} from "@/lib/media-cleanup"

export const dynamic = "force-dynamic"

export async function GET() {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const report = await getMediaCleanupReport()
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  })
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const body = await request.json().catch(() => ({}))
  const mode = typeof body?.mode === "string" ? body.mode : "cycle"

  if (mode === "reconcile") {
    return NextResponse.json(await reconcileMediaCleanup())
  }
  if (mode === "expired") {
    return NextResponse.json(await deleteExpiredUnreferencedMedia())
  }
  return NextResponse.json(await runMediaCleanupCycle())
}
