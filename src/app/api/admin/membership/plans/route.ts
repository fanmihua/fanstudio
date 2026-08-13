import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { dangerDeleteError, isDangerDeleteConfirmed } from "@/lib/admin-delete-guard"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function findProduct(productKey: string) {
  if (!productKey) return null
  return prisma.product.findUnique({ where: { key: productKey }, select: { id: true, key: true, name: true } })
}

/** GET: 指定产品的全部套餐（含禁用，按 sortOrder）。product 为必填。 */
export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const productKey = new URL(request.url).searchParams.get("product")?.trim() || ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await findProduct(productKey)
  if (!product) return NextResponse.json({ error: "产品不存在" }, { status: 404 })
  const plans = await prisma.membershipPlan.findMany({
    where: { productId: product.id },
    orderBy: { sortOrder: "asc" },
  })
  return NextResponse.json(
    plans.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      price: Number(p.price),
      originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
      durationDays: p.durationDays,
      enabled: p.enabled,
      badge: p.badge,
      recommended: p.recommended,
      sortOrder: p.sortOrder,
    })),
  )
}

/** PATCH: 更新指定产品的套餐。body: { id, product, name?, price?, originalPrice?, durationDays?, enabled?, badge?, sortOrder? }。 */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }
  const id = body.id
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 })
  }
  const productKey = typeof body.product === "string" ? body.product.trim() : ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await findProduct(productKey)
  if (!product) return NextResponse.json({ error: "产品不存在" }, { status: 404 })
  const target = await prisma.membershipPlan.findUnique({ where: { id }, select: { productId: true } })
  if (!target || target.productId !== product.id) {
    return NextResponse.json({ error: "该产品下不存在此套餐" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim()
  if (body.price != null) {
    const n = Number(body.price)
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "价格无效" }, { status: 400 })
    data.price = n
  }
  if ("originalPrice" in body) {
    if (body.originalPrice == null || body.originalPrice === "") data.originalPrice = null
    else {
      const n = Number(body.originalPrice)
      if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "原价无效" }, { status: 400 })
      data.originalPrice = n
    }
  }
  if ("durationDays" in body) {
    if (body.durationDays == null || body.durationDays === "") data.durationDays = null
    else {
      const n = Number(body.durationDays)
      if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: "有效天数无效（留空=永久）" }, { status: 400 })
      data.durationDays = n
    }
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled
  if (typeof body.recommended === "boolean") data.recommended = body.recommended
  if ("badge" in body) data.badge = body.badge ? String(body.badge).trim() : null
  if (body.sortOrder != null) {
    const n = Number(body.sortOrder)
    if (Number.isInteger(n)) data.sortOrder = n
  }

  // 推荐为同产品内单选：设为推荐时，先清掉同产品其它套餐的推荐，避免出现两张橙描边。
  if (data.recommended === true) {
    await prisma.$transaction([
      prisma.membershipPlan.updateMany({
        where: { productId: product.id, id: { not: id } },
        data: { recommended: false },
      }),
      prisma.membershipPlan.update({ where: { id }, data }),
    ])
    return NextResponse.json({ ok: true })
  }

  const plan = await prisma.membershipPlan.update({ where: { id }, data }).catch(() => null)
  if (!plan) return NextResponse.json({ error: "套餐不存在" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

/** DELETE: 删除指定产品的套餐。历史会员订单保留 planName 快照，并把 planId 清空。 */
export async function DELETE(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const searchParams = new URL(request.url).searchParams
  const id = searchParams.get("id")?.trim() || ""
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 })
  const productKey = searchParams.get("product")?.trim() || ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await findProduct(productKey)
  if (!product) return NextResponse.json({ error: "产品不存在" }, { status: 404 })

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }
  if (!isDangerDeleteConfirmed(body)) {
    return NextResponse.json(dangerDeleteError(), { status: 400 })
  }

  const plan = await prisma.membershipPlan.findUnique({ where: { id }, select: { id: true, productId: true } })
  if (!plan || plan.productId !== product.id) {
    return NextResponse.json({ error: "该产品下不存在此套餐" }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.membershipOrder.updateMany({ where: { planId: id }, data: { planId: null } }),
    prisma.membershipPlan.delete({ where: { id } }),
  ])
  return NextResponse.json({ ok: true })
}
