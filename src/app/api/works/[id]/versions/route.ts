import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { sanitizeVersionForPublic } from "@/lib/sanitize-work"

export const dynamic = "force-dynamic"

/** GET: 获取作品版本列表；管理员返回完整信息，非管理员脱敏。 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN"
  const { id } = await params
  const versions = await prisma.workVersion.findMany({
    where: { workId: id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(
    versions.map((v) => {
      const row = { ...v, price: Number(v.price) }
      return isAdmin ? row : sanitizeVersionForPublic(row)
    }),
  )
}

/** POST: 创建新版本。body: { version, price, changelog?, deliveryUrl? }；并更新 Work 快捷字段。 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const { id } = await params
  const body = await request.json()
  const { version, price, changelog, figmaUrl, deliveryUrl } = body

  if (!version || typeof version !== "string") {
    return NextResponse.json({ error: "请填写版本号" }, { status: 400 })
  }
  if (price == null || isNaN(Number(price))) {
    return NextResponse.json({ error: "请填写有效的价格" }, { status: 400 })
  }

  // 检查作品存在
  const work = await prisma.work.findUnique({ where: { id } })
  if (!work) {
    return NextResponse.json({ error: "作品不存在" }, { status: 404 })
  }

  // 检查版本号唯一
  const existing = await prisma.workVersion.findUnique({
    where: { workId_version: { workId: id, version: version.trim() } },
  })
  if (existing) {
    return NextResponse.json({ error: `版本 ${version} 已存在` }, { status: 400 })
  }

  // 获取上一个版本（用于继承 deliveryUrl）
  const latestVersion = await prisma.workVersion.findFirst({
    where: { workId: id },
    orderBy: { createdAt: "desc" },
  })

  const finalFigmaUrl = figmaUrl || latestVersion?.figmaUrl || work.figmaUrl || null
  const finalDeliveryUrl = deliveryUrl || latestVersion?.deliveryUrl || work.deliveryUrl || null

  // 创建版本 + 更新 Work 快捷字段（事务）
  const [newVersion] = await prisma.$transaction([
    prisma.workVersion.create({
      data: {
        workId: id,
        version: version.trim(),
        price: Number(price),
        changelog: changelog?.trim() || null,
        figmaUrl: finalFigmaUrl,
        deliveryUrl: finalDeliveryUrl,
      },
    }),
    prisma.work.update({
      where: { id },
      data: {
        currentVersion: version.trim(),
        price: Number(price),
        figmaUrl: finalFigmaUrl,
        deliveryUrl: finalDeliveryUrl,
      },
    }),
  ])

  return NextResponse.json({
    ...newVersion,
    price: Number(newVersion.price),
  })
}
