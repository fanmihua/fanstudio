import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { patchI18nObject } from "@/lib/i18n-content"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params
  const body = await request.json()
  const { name, nameI18n } = body

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "标签名称不能为空" }, { status: 400 })
  }

  const existing = await prisma.tag.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "标签不存在" }, { status: 404 })
  }

  // 检查新名称是否与其他标签冲突
  const conflict = await prisma.tag.findFirst({
    where: { name: name.trim(), id: { not: id } },
  })
  if (conflict) {
    return NextResponse.json({ error: "该标签名已存在" }, { status: 409 })
  }

  const updated = await prisma.tag.update({
    where: { id },
    data: {
      name: name.trim(),
      ...(nameI18n !== undefined
        ? { nameI18n: patchI18nObject(existing.nameI18n, nameI18n) as Record<string, unknown> }
        : {}),
    } as Parameters<typeof prisma.tag.update>[0]["data"],
  })
  return NextResponse.json(updated)
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id } = await params

  const existing = await prisma.tag.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "标签不存在" }, { status: 404 })
  }

  // Prisma 的隐式多对多关系在删除时会自动解除关联
  await prisma.tag.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
