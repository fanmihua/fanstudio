import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { normalizeCoverRatio } from "@/lib/cover-ratio"
import { safeDeleteKnowledgeSource, safeSyncKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { DEFAULT_LOCALE, fromPrismaLocale, isLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { buildPostI18nInput, localizePost } from "@/lib/localized-content"
import { safeRunMediaCleanupCycle } from "@/lib/media-cleanup"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const localeParam = new URL(request.url).searchParams.get("locale")
  const locale = isLocale(localeParam)
    ? localeParam
    : normalizeLocale(request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE)
  const { id } = await params
  const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } })
  const fallbackLocale = fromPrismaLocale(settings?.defaultLocale)
  const post = await prisma.post.findUnique({
    where: { id },
    include: { category: true, tags: true, author: true },
  })
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const isAdminRole = (session?.user as { role?: string })?.role === "ADMIN"
  if (post.status !== "PUBLISHED" && !isAdminRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (isAdminRole) return NextResponse.json(post)
  return NextResponse.json(localizePost(post as unknown as Record<string, unknown>, locale, fallbackLocale))
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
    content,
    excerpt,
    coverImage,
    coverRatio,
    status,
    categoryId,
    sortOrder,
    tagIds,
    ctaProductId,
    ctaLabel,
    contentI18n,
  } = body

  const existing = await prisma.post.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...(title != null && { title }),
      ...(slug != null && { slug: slug.trim() }),
      ...(content != null && { content }),
      ...(excerpt != null && { excerpt }),
      ...(coverImage != null && { coverImage }),
      ...(coverRatio != null && { coverRatio: normalizeCoverRatio(coverRatio) }),
      ...(status != null && {
        status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      }),
      ...(categoryId != null && { categoryId: categoryId || null }),
      ...(ctaProductId !== undefined && { ctaProductId: ctaProductId || null }),
      ...(ctaLabel !== undefined && { ctaLabel: ctaLabel?.trim() || null }),
      ...(sortOrder != null && { sortOrder: parseInt(String(sortOrder), 10) || 0 }),
      ...(tagIds != null && {
        tags: { set: (tagIds as string[]).map((tid: string) => ({ id: tid })) },
      }),
      ...(buildPostI18nInput({
        ...existing,
        ...body,
        // 文章正文为单语言编辑器，只写入 content；content 变更时用新正文重建 contentI18n，避免沿用创建时的空壳 {} 或旧值
        ...(content != null && contentI18n == null ? { contentI18n: undefined } : {}),
      })),
    },
    include: { tags: true },
  })
  if (post.status === "PUBLISHED") {
    await safeSyncKnowledgeSource("POST", post.id)
  } else {
    await safeDeleteKnowledgeSource("POST", post.id)
  }
  await safeRunMediaCleanupCycle("post:update")
  return NextResponse.json(post)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  await prisma.post.delete({ where: { id } })
  await safeDeleteKnowledgeSource("POST", id)
  await safeRunMediaCleanupCycle("post:delete")
  return NextResponse.json({ ok: true })
}
