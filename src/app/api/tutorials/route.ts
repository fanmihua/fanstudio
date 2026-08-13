import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { normalizeCoverRatio } from "@/lib/cover-ratio"
import { safeSyncKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { DEFAULT_LOCALE, fromPrismaLocale, isLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { buildTutorialI18nInput, localizeTutorial } from "@/lib/localized-content"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get("slug")
    const locale = normalizeLocale(
      searchParams.get("locale") ?? request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE,
    )
    const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } })
    const fallbackLocale = fromPrismaLocale(settings?.defaultLocale)

    if (slug) {
      const item = await prisma.videoTutorial.findUnique({
        where: { slug },
        include: { category: true, tags: true },
      })
      if (!item) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      return NextResponse.json(localizeTutorial(item as unknown as Record<string, unknown>, locale, fallbackLocale))
    }

    const list = await prisma.videoTutorial.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { category: true, tags: true },
    })
    return NextResponse.json(list.map((row) => localizeTutorial(row as unknown as Record<string, unknown>, locale, fallbackLocale)), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    })
  } catch (e) {
    console.error("[/api/tutorials] GET failed:", e)
    return NextResponse.json(
      {
        error: "请求失败",
        // 仅开发环境回传细节，生产不泄露 Prisma/堆栈信息
        detail: process.env.NODE_ENV !== "production" ? (e instanceof Error ? e.message : String(e)) : undefined,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const body = await request.json()
  const { title, slug, description, videoUrl, thumbnail, coverRatio, sortOrder } = body

  if (!title || !slug) {
    return NextResponse.json(
      { error: "缺少 title 或 slug" },
      { status: 400 }
    )
  }

  const existing = await prisma.videoTutorial.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: "slug 已存在" }, { status: 400 })
  }

  const item = await prisma.videoTutorial.create({
    data: {
      title,
      slug: slug.trim(),
      description: description || null,
      videoUrl: videoUrl?.trim() || "",
      thumbnail: thumbnail?.trim() || null,
      coverRatio: normalizeCoverRatio(coverRatio),
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      ...buildTutorialI18nInput(body),
    },
  })
  await safeSyncKnowledgeSource("TUTORIAL", item.id)
  return NextResponse.json(item)
}
