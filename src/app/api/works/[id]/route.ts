import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { sanitizeWorkForPublic } from "@/lib/sanitize-work"
import { normalizeCoverRatio } from "@/lib/cover-ratio"
import { safeDeleteKnowledgeSource, safeSyncKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { DEFAULT_LOCALE, fromPrismaLocale, isLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { buildWorkI18nInput, localizeWork } from "@/lib/localized-content"
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
  const work = await prisma.work.findUnique({
    where: { id },
    include: { category: true, tags: true },
  })
  if (!work) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const isAdminRole = (session?.user as { role?: string })?.role === "ADMIN"
  if (work.status !== "PUBLISHED" && !isAdminRole) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const row = {
    ...work,
    price: work.price ? Number(work.price) : null,
    images: (work.images as string[]) || [],
  }
  if (isAdminRole) return NextResponse.json(row)
  const localized = localizeWork(row as unknown as Record<string, unknown>, locale, fallbackLocale)
  return NextResponse.json({
    ...sanitizeWorkForPublic(localized),
    _deliveryRedacted: true,
  })
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
    workType,
    description,
    content,
    coverImage,
    coverRatio,
    images,
    price,
    isFree,
    figmaUrl,
    deliveryUrl,
    demoUrl,
    demoQrCode,
    status,
    categoryId,
    sortOrder,
    tagIds,
  } = body

  const existing = await prisma.work.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const work = await prisma.work.update({
    where: { id },
    data: {
      ...(title != null && { title }),
      ...(slug != null && { slug: slug.trim() }),
      ...(workType != null && {
        workType: workType === "DEVELOPMENT" ? "DEVELOPMENT" : "DESIGN",
      }),
      ...(description != null && { description }),
      ...(content != null && { content }),
      ...(coverImage != null && { coverImage }),
      ...(coverRatio != null && { coverRatio: normalizeCoverRatio(coverRatio) }),
      ...(images != null && { images }),
      ...(price != null && { price }),
      ...(typeof isFree === "boolean" && { isFree }),
      ...(figmaUrl !== undefined && { figmaUrl: figmaUrl || null }),
      ...(deliveryUrl !== undefined && { deliveryUrl: deliveryUrl || null }),
      ...(demoUrl !== undefined && { demoUrl: demoUrl || null }),
      ...(demoQrCode !== undefined && { demoQrCode: demoQrCode || null }),
      ...(status != null && {
        status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      }),
      ...(categoryId != null && { categoryId: categoryId || null }),
      ...(sortOrder != null && { sortOrder: parseInt(String(sortOrder), 10) || 0 }),
      ...(tagIds != null && {
        tags: { set: (tagIds as string[]).map((tid: string) => ({ id: tid })) },
      }),
      ...(buildWorkI18nInput({
        ...existing,
        ...body,
      })),
    },
    include: { tags: true },
  })
  if (work.status === "PUBLISHED") {
    await safeSyncKnowledgeSource("WORK", work.id)
  } else {
    await safeDeleteKnowledgeSource("WORK", work.id)
  }
  await safeRunMediaCleanupCycle("work:update")
  return NextResponse.json(work)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  const orderCount = await prisma.order.count({ where: { workId: id } })
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `该作品有 ${orderCount} 笔关联订单，无法删除。请先处理相关订单。` },
      { status: 409 }
    )
  }
  await prisma.work.delete({ where: { id } })
  await safeDeleteKnowledgeSource("WORK", id)
  await safeRunMediaCleanupCycle("work:delete")
  return NextResponse.json({ ok: true })
}
