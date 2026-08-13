import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { rebuildKnowledge } from "@/lib/ai/knowledge"

export const dynamic = "force-dynamic"

export async function POST() {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    await rebuildKnowledge()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: "重建知识库失败", detail: e instanceof Error ? e.message : "未知错误" },
      { status: 500 },
    )
  }
}

