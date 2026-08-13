import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { dangerDeleteError, isDangerDeleteConfirmed } from "@/lib/admin-delete-guard"
import prisma from "@/lib/prisma"
import { normalizePromoCode } from "@/lib/promo"
import { MembershipPlanKey } from "@prisma/client"

export const dynamic = "force-dynamic"

const VALID_KEYS = Object.values(MembershipPlanKey) as string[]

async function findProduct(productKey: string) {
  if (!productKey) return null
  return prisma.product.findUnique({ where: { key: productKey }, select: { id: true, key: true, name: true } })
}

async function productHasPlan(productId: string, planKey: unknown) {
  if (typeof planKey !== "string") return true
  const plan = await prisma.membershipPlan.findUnique({
    where: { productId_key: { productId, key: planKey as MembershipPlanKey } },
    select: { id: true },
  })
  return !!plan
}

function serialize(c: {
  id: string; code: string; planKey: string | null; percentOff: number
  maxRedemptions: number | null; redeemedCount: number
  startsAt: Date | null; expiresAt: Date | null; enabled: boolean; note: string | null
}) {
  return {
    id: c.id, code: c.code, planKey: c.planKey, percentOff: c.percentOff,
    maxRedemptions: c.maxRedemptions, redeemedCount: c.redeemedCount,
    startsAt: c.startsAt, expiresAt: c.expiresAt, enabled: c.enabled, note: c.note,
  }
}

/** 解析并校验入参（建/改共用）。返回 data 或错误。 */
function parseData(
  body: Record<string, unknown>,
  productId: string,
  isCreate: boolean,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const data: Record<string, unknown> = {}

  if (isCreate || "code" in body) {
    const code = normalizePromoCode(String(body.code ?? ""))
    if (!code) return { ok: false, error: "请输入码串" }
    if (code.length > 64) return { ok: false, error: "码串过长" }
    data.code = code
  }
  if (isCreate) data.productId = productId

  if (isCreate || "percentOff" in body) {
    const n = Number(body.percentOff)
    if (!Number.isInteger(n) || n < 1 || n > 99) return { ok: false, error: "折扣力度需为 1–99 的整数(20=8 折)" }
    data.percentOff = n
  }
  if ("planKey" in body) {
    const k = body.planKey
    if (k == null || k === "" || k === "ALL") data.planKey = null
    else if (typeof k === "string" && VALID_KEYS.includes(k)) data.planKey = k
    else return { ok: false, error: "适用套餐无效" }
  } else if (isCreate) {
    data.planKey = null
  }
  if ("maxRedemptions" in body) {
    if (body.maxRedemptions == null || body.maxRedemptions === "") data.maxRedemptions = null
    else {
      const n = Number(body.maxRedemptions)
      if (!Number.isInteger(n) || n <= 0) return { ok: false, error: "数量需为正整数(留空=不限)" }
      data.maxRedemptions = n
    }
  }
  for (const f of ["startsAt", "expiresAt"] as const) {
    if (f in body) {
      const v = body[f]
      if (v == null || v === "") data[f] = null
      else {
        const d = new Date(String(v))
        if (isNaN(d.getTime())) return { ok: false, error: "时间格式无效" }
        data[f] = d
      }
    }
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled
  if ("note" in body) data.note = body.note ? String(body.note).trim().slice(0, 255) : null
  return { ok: true, data }
}

/** GET: 指定产品的全部折扣码（按创建倒序），含已用计数。product 为必填。 */
export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const productKey = new URL(request.url).searchParams.get("product")?.trim() || ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await findProduct(productKey)
  if (!product) return NextResponse.json({ error: "产品不存在" }, { status: 404 })
  const codes = await prisma.promoCode.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(codes.map(serialize))
}

/** POST: 新建折扣码。body: { code, percentOff, planKey?, maxRedemptions?, startsAt?, expiresAt?, note?, product }。 */
export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const productKey = typeof body.product === "string" ? body.product.trim() : ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await findProduct(productKey)
  if (!product) return NextResponse.json({ error: "产品不存在" }, { status: 404 })

  const parsed = parseData(body, product.id, true)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!(await productHasPlan(product.id, parsed.data.planKey))) {
    return NextResponse.json({ error: "该产品下不存在此套餐" }, { status: 400 })
  }

  try {
    const created = await prisma.promoCode.create({ data: parsed.data as never })
    return NextResponse.json(serialize(created))
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "该码串已存在" }, { status: 409 })
    }
    return NextResponse.json({ error: "创建失败" }, { status: 500 })
  }
}

/** PATCH: 改指定产品的折扣码。body 含 id 与 product。 */
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
  if (!id || typeof id !== "string") return NextResponse.json({ error: "缺少 id" }, { status: 400 })
  const productKey = typeof body.product === "string" ? body.product.trim() : ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await findProduct(productKey)
  if (!product) return NextResponse.json({ error: "产品不存在" }, { status: 404 })
  const target = await prisma.promoCode.findUnique({ where: { id }, select: { productId: true } })
  if (!target || target.productId !== product.id) {
    return NextResponse.json({ error: "该产品下不存在此折扣码" }, { status: 404 })
  }

  const parsed = parseData(body, "", false)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (!(await productHasPlan(product.id, parsed.data.planKey))) {
    return NextResponse.json({ error: "该产品下不存在此套餐" }, { status: 400 })
  }

  try {
    await prisma.promoCode.update({ where: { id }, data: parsed.data as never })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "该码串已存在" }, { status: 409 })
    }
    return NextResponse.json({ error: "折扣码不存在" }, { status: 404 })
  }
}

/** DELETE: 删指定产品的折扣码。?id=xxx&product=key + body {confirmText}。 */
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
  if (!isDangerDeleteConfirmed(body)) return NextResponse.json(dangerDeleteError(), { status: 400 })

  const exists = await prisma.promoCode.findUnique({ where: { id }, select: { id: true, productId: true } })
  if (!exists || exists.productId !== product.id) {
    return NextResponse.json({ error: "该产品下不存在此折扣码" }, { status: 404 })
  }
  await prisma.promoCode.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
