import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

function parseLandingPath(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, value: null }
  if (typeof value !== "string") return { ok: false, error: "入口路径格式错误" }
  const landingPath = value.trim()
  if (!landingPath) return { ok: true, value: null }
  if (
    landingPath.length > 255 ||
    !landingPath.startsWith("/") ||
    landingPath.startsWith("//") ||
    /[\\\u0000-\u001F\u007F]/.test(landingPath)
  ) {
    return { ok: false, error: "入口路径必须是以单个 / 开头的站内路径，且不超过 255 个字符" }
  }
  return { ok: true, value: landingPath }
}

/** GET: 全部产品（按 sortOrder）。 */
export async function GET() {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const products = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } })
  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      blurb: p.blurb,
      landingPath: p.landingPath,
      enabled: p.enabled,
      isAllAccess: p.isAllAccess,
      sortOrder: p.sortOrder,
    })),
  )
}

/** POST: 新建产品。body: { key, name, blurb?, landingPath?, enabled?, isAllAccess?, sortOrder? }。 */
export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }
  const key = typeof body.key === "string" ? body.key.trim() : ""
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!/^[a-z0-9-]+$/.test(key)) {
    return NextResponse.json({ error: "key 只能用小写字母/数字/连字符" }, { status: 400 })
  }
  if (!name) return NextResponse.json({ error: "缺少名称" }, { status: 400 })
  const landingPath = parseLandingPath(body.landingPath)
  if (!landingPath.ok) return NextResponse.json({ error: landingPath.error }, { status: 400 })
  const exists = await prisma.product.findUnique({ where: { key } })
  if (exists) return NextResponse.json({ error: "该 key 已存在" }, { status: 409 })
  await prisma.product.create({
    data: {
      key,
      name,
      blurb: typeof body.blurb === "string" ? body.blurb.trim() || null : null,
      landingPath: landingPath.value,
      enabled: body.enabled !== false,
      isAllAccess: body.isAllAccess === true,
      sortOrder: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    },
  })
  return NextResponse.json({ ok: true })
}

/** PATCH: 更新产品。body: { id, name?, blurb?, landingPath?, enabled?, isAllAccess?, sortOrder? }。 */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }
  const id = typeof body.id === "string" ? body.id : ""
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 })
  const data: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if ("blurb" in body) data.blurb = body.blurb ? String(body.blurb).trim() : null
  if ("landingPath" in body) {
    const landingPath = parseLandingPath(body.landingPath)
    if (!landingPath.ok) return NextResponse.json({ error: landingPath.error }, { status: 400 })
    data.landingPath = landingPath.value
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled
  if (typeof body.isAllAccess === "boolean") data.isAllAccess = body.isAllAccess
  if (body.sortOrder != null && Number.isInteger(Number(body.sortOrder))) {
    data.sortOrder = Number(body.sortOrder)
  }
  const updated = await prisma.product.update({ where: { id }, data }).catch(() => null)
  if (!updated) return NextResponse.json({ error: "产品不存在" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

/** DELETE: 删除产品（带保护）。?id=xxx。仅当无订单、权益或文章入口时可删。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const id = new URL(request.url).searchParams.get("id")?.trim() || ""
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 })
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { orders: true, entitlements: true, ctaPosts: true } },
    },
  })
  if (!product) return NextResponse.json({ error: "产品不存在" }, { status: 404 })
  const c = product._count
  const blockers: string[] = []
  if (c.orders) blockers.push(`${c.orders} 笔订单`)
  if (c.entitlements) blockers.push(`${c.entitlements} 条权益`)
  if (c.ctaPosts) blockers.push(`${c.ctaPosts} 篇文章入口`)
  if (blockers.length) {
    return NextResponse.json(
      { error: `还挂着 ${blockers.join(" / ")}，不能删除——请先停用，或解除这些关联后再删。` },
      { status: 409 },
    )
  }
  // 干净：先删除套餐配置，再删除产品。
  await prisma.$transaction([
    prisma.membershipPlan.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ])
  return NextResponse.json({ ok: true })
}
