import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string; versionId: string }> }

/** DELETE: 删除版本。已有已支付订单则禁止；若删的是当前最新版本则回退 Work 到次新版本。 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id: workId, versionId } = await params

  const version = await prisma.workVersion.findUnique({ where: { id: versionId } })
  if (!version || version.workId !== workId) {
    return NextResponse.json({ error: "版本不存在" }, { status: 404 })
  }

  const paidOrderCount = await prisma.order.count({
    where: { versionId, status: "PAID" },
  })
  if (paidOrderCount > 0) {
    return NextResponse.json(
      { error: `该版本已有 ${paidOrderCount} 个已支付订单，无法删除` },
      { status: 400 },
    )
  }

  const work = await prisma.work.findUnique({ where: { id: workId } })
  if (!work) {
    return NextResponse.json({ error: "作品不存在" }, { status: 404 })
  }

  const isCurrentVersion = work.currentVersion === version.version

  await prisma.order.updateMany({
    where: { versionId, status: { not: "PAID" } },
    data: { versionId: null },
  })
  await prisma.workVersion.delete({ where: { id: versionId } })

  if (isCurrentVersion) {
    const prevVersion = await prisma.workVersion.findFirst({
      where: { workId },
      orderBy: { createdAt: "desc" },
    })

    if (prevVersion) {
      await prisma.work.update({
        where: { id: workId },
        data: {
          currentVersion: prevVersion.version,
          price: Number(prevVersion.price),
          figmaUrl: prevVersion.figmaUrl,
          deliveryUrl: prevVersion.deliveryUrl,
        },
      })
    } else {
      await prisma.work.update({
        where: { id: workId },
        data: {
          currentVersion: null,
          price: null,
          figmaUrl: null,
          deliveryUrl: null,
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}

/** PUT: 编辑版本（价格、更新说明、交付链接）；若为当前最新版本则同步 Work 快捷字段。 */
export async function PUT(request: NextRequest, { params }: Params) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { id: workId, versionId } = await params
  const body = await request.json()
  const { price, changelog, figmaUrl, deliveryUrl } = body

  // 查找版本
  const version = await prisma.workVersion.findUnique({ where: { id: versionId } })
  if (!version || version.workId !== workId) {
    return NextResponse.json({ error: "版本不存在" }, { status: 404 })
  }

  // 构建更新数据
  const updateData: Record<string, unknown> = {}
  if (price != null && !isNaN(Number(price))) {
    updateData.price = Number(price)
  }
  if (changelog !== undefined) {
    updateData.changelog = changelog?.trim() || null
  }
  if (figmaUrl !== undefined) {
    updateData.figmaUrl = figmaUrl?.trim() || null
  }
  if (deliveryUrl !== undefined) {
    updateData.deliveryUrl = deliveryUrl?.trim() || null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 })
  }

  // 更新版本
  const updated = await prisma.workVersion.update({
    where: { id: versionId },
    data: updateData,
  })

  // 如果该版本是当前最新版本，同步更新 Work 快捷字段
  const work = await prisma.work.findUnique({ where: { id: workId } })
  if (work && work.currentVersion === version.version) {
    const workUpdate: Record<string, unknown> = {}
    if (updateData.price != null) workUpdate.price = updateData.price
    if (updateData.figmaUrl !== undefined) workUpdate.figmaUrl = updateData.figmaUrl
    if (updateData.deliveryUrl !== undefined) workUpdate.deliveryUrl = updateData.deliveryUrl

    if (Object.keys(workUpdate).length > 0) {
      await prisma.work.update({ where: { id: workId }, data: workUpdate })
    }
  }

  return NextResponse.json({
    ...updated,
    price: Number(updated.price),
  })
}
