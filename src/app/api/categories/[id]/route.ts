import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { patchI18nObject } from "@/lib/i18n-content"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function PUT(request: NextRequest, { params }: Params) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params
  const body = await request.json()
  const { name, slug, nameI18n, slugI18n } = body

  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "分类不存在" }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (name && typeof name === "string" && name.trim()) {
    updateData.name = name.trim()
  }
  if (slug && typeof slug === "string" && slug.trim()) {
    // 检查 slug 唯一性
    const slugConflict = await prisma.category.findFirst({
      where: { slug: slug.trim(), id: { not: id } },
    })
    if (slugConflict) {
      return NextResponse.json({ error: "该 Slug 已被使用" }, { status: 409 })
    }
    updateData.slug = slug.trim()
  }
  if (nameI18n !== undefined) {
    updateData.nameI18n = patchI18nObject(existing.nameI18n, nameI18n)
  }
  if (slugI18n !== undefined) {
    const patched = patchI18nObject(existing.slugI18n, slugI18n)
    updateData.slugI18n = {
      ...patched,
      zh: typeof patched.zh === "string" && patched.zh.trim() ? toSlug(patched.zh) : patched.zh,
      en: typeof patched.en === "string" && patched.en.trim() ? toSlug(patched.en) : patched.en,
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "没有要更新的字段" }, { status: 400 })
  }

  const updated = await prisma.category.update({ where: { id }, data: updateData })
  return NextResponse.json(updated)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params

  const existing = await prisma.category.findUnique({
    where: { id },
    include: {
      _count: { select: { posts: true, works: true, tutorials: true } },
    },
  })
  if (!existing) {
    return NextResponse.json({ error: "分类不存在" }, { status: 404 })
  }

  const relatedCount = existing._count.posts + existing._count.works + existing._count.tutorials

  if (relatedCount > 0) {
    // 解除关联后再删除
    if (existing.type === "POST") {
      await prisma.post.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      })
    } else if (existing.type === "TUTORIAL") {
      await prisma.videoTutorial.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      })
    } else {
      // DESIGN, DEVELOPMENT, WORK
      await prisma.work.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      })
    }
  }

  await prisma.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
