import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { sanitizeWorkForPublic } from "@/lib/sanitize-work"
import { normalizeCoverRatio } from "@/lib/cover-ratio"
import { safeSyncKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { DEFAULT_LOCALE, fromPrismaLocale, isLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { buildWorkI18nInput, localizeWork } from "@/lib/localized-content"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await auth()
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")
  const all = searchParams.get("all") === "1"
  const typeParam = searchParams.get("type")
  const locale = normalizeLocale(
    searchParams.get("locale") ?? request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE,
  )

  const isAdminRole = (session?.user as { role?: string })?.role === "ADMIN"
  const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } })
  const fallbackLocale = fromPrismaLocale(settings?.defaultLocale)

  if (slug) {
    const work = await prisma.work.findUnique({
      where: { slug },
      include: { category: true, tags: true },
    })
    if (!work) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (work.status !== "PUBLISHED" && !isAdminRole) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const downloadCount = await prisma.order.count({ where: { workId: work.id, status: "PAID" } })
    const row = {
      ...work,
      downloadCount,
      price: work.price ? Number(work.price) : null,
      images: (work.images as string[]) || [],
    }
    const localized = localizeWork(row as unknown as Record<string, unknown>, locale, fallbackLocale)
    return NextResponse.json(isAdminRole ? localized : sanitizeWorkForPublic(localized))
  }

  const isAdmin = isAdminRole
  const workTypeFilter =
    typeParam === "design"
      ? "DESIGN"
      : typeParam === "development"
        ? "DEVELOPMENT"
        : undefined
  const where: { workType?: "DESIGN" | "DEVELOPMENT"; status?: "PUBLISHED" } = {
    ...(workTypeFilter && { workType: workTypeFilter }),
    ...(isAdmin && all ? {} : { status: "PUBLISHED" }),
  }
  const list = await prisma.work.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { category: true, tags: true },
  })
  const ids = list.map((w) => w.id)
  const dlGroups = ids.length
    ? await prisma.order.groupBy({ by: ["workId"], where: { status: "PAID", workId: { in: ids } }, _count: { _all: true } })
    : []
  const dlMap = new Map(dlGroups.map((g) => [g.workId, g._count._all]))
  const rows = list.map((w) => {
    const row = {
      ...w,
      downloadCount: dlMap.get(w.id) ?? 0,
      price: w.price ? Number(w.price) : null,
      images: (w.images as string[]) || [],
    }
    const localized = localizeWork(row as unknown as Record<string, unknown>, locale, fallbackLocale)
    return isAdmin ? localized : sanitizeWorkForPublic(localized)
  })
  const headers = isAdmin ? undefined : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
  return NextResponse.json(rows, { headers })
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
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
  } = body

  if (!title || !slug) {
    return NextResponse.json(
      { error: "缺少 title 或 slug" },
      { status: 400 }
    )
  }

  const existing = await prisma.work.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: "slug 已存在" }, { status: 400 })
  }

  const authorExists = await prisma.user.findUnique({ where: { id: check.userId } })
  if (!authorExists) {
    return NextResponse.json(
      { error: "当前登录用户在本数据库中不存在，请退出登录后重新登录" },
      { status: 401 }
    )
  }

  const work = await prisma.work.create({
    data: {
      title,
      slug: slug.trim(),
      workType:
        workType === "DEVELOPMENT" ? "DEVELOPMENT" : "DESIGN",
      description: description || null,
      content: content ?? undefined,
      coverImage: coverImage || "",
      coverRatio: normalizeCoverRatio(coverRatio),
      images: images ?? [],
      price: price != null ? price : null,
      isFree: !!isFree,
      figmaUrl: figmaUrl || null,
      deliveryUrl: deliveryUrl || null,
      demoUrl: demoUrl || null,
      demoQrCode: demoQrCode || null,
      status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      categoryId: categoryId || null,
      authorId: check.userId,
      ...buildWorkI18nInput(body),
    },
  })
  if (work.status === "PUBLISHED") {
    await safeSyncKnowledgeSource("WORK", work.id)
  }
  return NextResponse.json(work)
}
