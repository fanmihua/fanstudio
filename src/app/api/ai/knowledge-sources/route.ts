import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"

export const dynamic = "force-dynamic"

type SourceRow = {
  id: string
  sourceType: "POST" | "WORK" | "TUTORIAL" | "SETTINGS"
  sourceId: string
  title: string
  url: string
  updatedAt: string
  chunkCount: number
  chunkPreview: Array<{ chunkIndex: number; contentText: string }>
}

export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const hasKnowledgeModel = Boolean((prisma as unknown as { knowledgeSource?: unknown }).knowledgeSource)
  if (!hasKnowledgeModel) {
    return NextResponse.json({ rows: [] as SourceRow[] })
  }

  const searchParams = request.nextUrl.searchParams
  const takeRaw = Number(searchParams.get("take") || "100")
  const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(300, Math.floor(takeRaw))) : 100

  const rows = await prisma.knowledgeSource.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      title: true,
      url: true,
      updatedAt: true,
      chunks: {
        orderBy: { chunkIndex: "asc" },
        take: 2,
        select: { chunkIndex: true, contentText: true },
      },
      _count: {
        select: { chunks: true },
      },
    },
  })

  const data: SourceRow[] = rows.map((item) => ({
    id: item.id,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    title: item.title,
    url: item.url,
    updatedAt: item.updatedAt.toISOString(),
    chunkCount: item._count.chunks,
    chunkPreview: item.chunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      contentText: c.contentText.slice(0, 220),
    })),
  }))

  return NextResponse.json({ rows: data })
}
