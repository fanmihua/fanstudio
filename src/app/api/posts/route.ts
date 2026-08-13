import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { normalizeCoverRatio } from "@/lib/cover-ratio"
import { safeSyncKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { DEFAULT_LOCALE, fromPrismaLocale, isLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { buildPostI18nInput, localizePost } from "@/lib/localized-content"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await auth()
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug")
  const all = searchParams.get("all") === "1"
  const locale = normalizeLocale(
    searchParams.get("locale") ?? request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE,
  )

  const isAdminRole = (session?.user as { role?: string })?.role === "ADMIN"
  const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } })
  const fallbackLocale = fromPrismaLocale(settings?.defaultLocale)

  if (slug) {
    const postRef = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM Post
      WHERE slug = ${slug}
        OR JSON_UNQUOTE(JSON_EXTRACT(slugI18n, '$.zh')) = ${slug}
        OR JSON_UNQUOTE(JSON_EXTRACT(slugI18n, '$.en')) = ${slug}
      LIMIT 1
    `
    const post = postRef[0]?.id
      ? await prisma.post.findUnique({
          where: { id: postRef[0].id },
          include: {
            category: true,
            tags: true,
            author: true,
            ctaProduct: { select: { name: true, landingPath: true, enabled: true } },
          },
        })
      : null
    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (post.status !== "PUBLISHED" && !isAdminRole) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(localizePost(post as unknown as Record<string, unknown>, locale, fallbackLocale))
  }

  const isAdmin = isAdminRole
  const list = await prisma.post.findMany({
    where: isAdmin && all ? undefined : { status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { category: true, tags: true, author: true },
  })
  const headers = isAdmin ? undefined : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
  return NextResponse.json(
    list.map((row) => localizePost(row as unknown as Record<string, unknown>, locale, fallbackLocale)),
    { headers },
  )
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const body = await request.json()
  const { title, slug, content, excerpt, coverImage, coverRatio, status, categoryId, ctaProductId, ctaLabel } = body

  if (!title || !slug) {
    return NextResponse.json(
      { error: "缺少 title 或 slug" },
      { status: 400 }
    )
  }

  const existing = await prisma.post.findUnique({ where: { slug } })
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

  const post = await prisma.post.create({
    data: {
      title,
      slug: slug.trim(),
      content: content ?? {},
      excerpt: excerpt || null,
      coverImage: coverImage || null,
      coverRatio: normalizeCoverRatio(coverRatio),
      status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      categoryId: categoryId || null,
      ctaProductId: ctaProductId || null,
      ctaLabel: ctaLabel?.trim() || null,
      authorId: check.userId,
      ...buildPostI18nInput(body),
    },
  })
  if (post.status === "PUBLISHED") {
    await safeSyncKnowledgeSource("POST", post.id)
  }
  return NextResponse.json(post)
}
