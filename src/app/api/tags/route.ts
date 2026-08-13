import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { DEFAULT_LOCALE, fromPrismaLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"
import { localizeTag } from "@/lib/localized-content"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = normalizeLocale(
    searchParams.get("locale") ?? request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE,
  )
  const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } })
  const fallbackLocale = fromPrismaLocale(settings?.defaultLocale)
  const list = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { posts: true, works: true, tutorials: true } },
      posts: { select: { id: true, title: true }, take: 20 },
      works: { select: { id: true, title: true, workType: true }, take: 20 },
      tutorials: { select: { id: true, title: true }, take: 20 },
    },
  })

  return NextResponse.json(
    list.map((t) => {
      const items: { id: string; title: string; entityType: string }[] = [
        ...t.posts.map((p) => ({ id: p.id, title: p.title, entityType: "post" as const })),
        ...t.works.map((w) => ({
          id: w.id,
          title: w.title,
          entityType: w.workType === "DEVELOPMENT" ? "development" : "design",
        })),
        ...t.tutorials.map((v) => ({ id: v.id, title: v.title, entityType: "tutorial" as const })),
      ]
      const localized = localizeTag(t as unknown as Record<string, unknown>, locale, fallbackLocale)
      return {
        id: t.id,
        name: localized.name,
        nameI18n: t.nameI18n,
        count: t._count.posts + t._count.works + t._count.tutorials,
        items,
      }
    }),
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  )
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const body = await request.json()
  const { name, nameI18n } = body

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "标签名称不能为空" }, { status: 400 })
  }

  // 检查是否已存在（标签名唯一）
  const existing = await prisma.tag.findUnique({ where: { name: name.trim() } })
  if (existing) {
    return NextResponse.json({ error: "该标签已存在" }, { status: 409 })
  }

  const tag = await prisma.tag.create({
    data: {
      name: name.trim(),
      nameI18n: {
        zh: name.trim(),
        en:
          nameI18n && typeof nameI18n === "object" && typeof (nameI18n as { en?: unknown }).en === "string"
            ? ((nameI18n as { en: string }).en.trim() || null)
            : null,
      },
    },
  })
  return NextResponse.json({ ...tag, count: 0 }, { status: 201 })
}
