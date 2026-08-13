import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { DEFAULT_LOCALE, fromPrismaLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { localizeCategory } from "@/lib/localized-content"

export const dynamic = "force-dynamic"

const VALID_TYPES = ["POST", "DESIGN", "DEVELOPMENT", "TUTORIAL", "WORK"] as const

/** 将名称转为 slug：小写、空格转连字符、去特殊字符。 */
function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || `cat-${Date.now()}`
}

type CategoryWithRelations = {
  type: string
  _count: { posts: number; works: number; tutorials: number }
  posts: { id: string; title: string }[]
  works: { id: string; title: string; workType: string }[]
  tutorials: { id: string; title: string }[]
}

function getCategoryCount(c: CategoryWithRelations): number {
  switch (c.type) {
    case "POST":
      return c._count.posts
    case "DESIGN":
    case "DEVELOPMENT":
    case "WORK":
      return c._count.works
    case "TUTORIAL":
      return c._count.tutorials
    default:
      return 0
  }
}

function getCategoryItems(c: CategoryWithRelations): { id: string; title: string; entityType: string }[] {
  switch (c.type) {
    case "POST":
      return c.posts.map((p) => ({ id: p.id, title: p.title, entityType: "post" }))
    case "DESIGN":
    case "DEVELOPMENT":
    case "WORK":
      return c.works.map((w) => ({ id: w.id, title: w.title, entityType: w.workType === "DEVELOPMENT" ? "development" : "design" }))
    case "TUTORIAL":
      return c.tutorials.map((t) => ({ id: t.id, title: t.title, entityType: "tutorial" }))
    default:
      return []
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const locale = normalizeLocale(
    searchParams.get("locale") ?? request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE,
  )
  const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } })
  const fallbackLocale = fromPrismaLocale(settings?.defaultLocale)

  // 构建过滤条件
  let where: Record<string, unknown> | undefined
  if (type && VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    where = { type }
  }

  const list = await prisma.category.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { posts: true, works: true, tutorials: true } },
      posts: { select: { id: true, title: true }, take: 20 },
      works: { select: { id: true, title: true, workType: true }, take: 20 },
      tutorials: { select: { id: true, title: true }, take: 20 },
    },
  })

  return NextResponse.json(
    list.map((c) => {
      const localized = localizeCategory(c as unknown as Record<string, unknown>, locale, fallbackLocale)
      return {
        id: c.id,
        name: localized.name,
        slug: localized.slug,
        nameI18n: c.nameI18n,
        slugI18n: c.slugI18n,
        type: c.type,
        count: getCategoryCount(c),
        items: getCategoryItems(c),
      }
    }),
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  )
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const body = await request.json()
  const { name, type, slug: inputSlug, nameI18n, slugI18n } = body

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "分类名称不能为空" }, { status: 400 })
  }
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "无效的分类类型" }, { status: 400 })
  }

  // 生成唯一 slug
  let slug = typeof inputSlug === "string" && inputSlug.trim() ? toSlug(inputSlug) : toSlug(name)
  const existing = await prisma.category.findUnique({ where: { slug } })
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const normalizedName = name.trim()
  const normalizedNameI18n = {
    zh: normalizedName,
    en:
      nameI18n && typeof nameI18n === "object" && typeof (nameI18n as { en?: unknown }).en === "string"
        ? ((nameI18n as { en: string }).en.trim() || null)
        : null,
  }
  const normalizedSlugI18n = {
    zh: slug,
    en:
      slugI18n && typeof slugI18n === "object" && typeof (slugI18n as { en?: unknown }).en === "string"
        ? (toSlug((slugI18n as { en: string }).en) || null)
        : null,
  }

  const category = await prisma.category.create({
    data: {
      name: normalizedName,
      slug,
      nameI18n: normalizedNameI18n,
      slugI18n: normalizedSlugI18n,
      type,
    },
  })

  return NextResponse.json({ ...category, count: 0 }, { status: 201 })
}
