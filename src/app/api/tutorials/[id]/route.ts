import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { normalizeCoverRatio } from "@/lib/cover-ratio"
import { safeDeleteKnowledgeSource, safeSyncKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { DEFAULT_LOCALE, fromPrismaLocale, isLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { buildTutorialI18nInput, localizeTutorial } from "@/lib/localized-content"
import { safeRunMediaCleanupCycle } from "@/lib/media-cleanup"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  const localeParam = new URL(request.url).searchParams.get("locale")
  const locale = isLocale(localeParam)
    ? localeParam
    : normalizeLocale(request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE)
  const { id } = await params
  const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } })
  const fallbackLocale = fromPrismaLocale(settings?.defaultLocale)
  const item = await prisma.videoTutorial.findUnique({
    where: { id },
    include: { tags: true },
  })
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (check.authorized) return NextResponse.json(item)
  return NextResponse.json(localizeTutorial(item as unknown as Record<string, unknown>, locale, fallbackLocale))
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  const body = await request.json()
  const {
    title,
    slug,
    description,
    videoUrl,
    thumbnail,
    coverRatio,
    sortOrder,
    categoryId,
    tagIds,
  } = body
  const existing = await prisma.videoTutorial.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const item = await prisma.videoTutorial.update({
    where: { id },
    data: {
      ...(title != null && { title }),
      ...(slug != null && { slug: slug.trim() }),
      ...(description != null && { description }),
      ...(videoUrl != null && { videoUrl: videoUrl.trim() }),
      ...(thumbnail != null && { thumbnail: thumbnail.trim() || null }),
      ...(coverRatio != null && { coverRatio: normalizeCoverRatio(coverRatio) }),
      ...(typeof sortOrder === "number" && { sortOrder }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
      ...(tagIds != null && {
        tags: { set: (tagIds as string[]).map((tid: string) => ({ id: tid })) },
      }),
      ...(buildTutorialI18nInput({
        ...existing,
        ...body,
      })),
    },
    include: { tags: true },
  })
  await safeSyncKnowledgeSource("TUTORIAL", item.id)
  await safeRunMediaCleanupCycle("tutorial:update")
  return NextResponse.json(item)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  await prisma.videoTutorial.delete({ where: { id } })
  await safeDeleteKnowledgeSource("TUTORIAL", id)
  await safeRunMediaCleanupCycle("tutorial:delete")
  return NextResponse.json({ ok: true })
}
