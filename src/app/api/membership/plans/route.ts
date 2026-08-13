import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getLifetimeUpgradeQuote } from "@/lib/membership"
import { getCurrentMember } from "@/lib/require-member"

export const dynamic = "force-dynamic"

/** GET: 某产品的前台可售套餐（仅 enabled），按 sortOrder。product 为必填。 */
export async function GET(request: NextRequest) {
  const productKey = new URL(request.url).searchParams.get("product")?.trim() || ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await prisma.product.findUnique({
    where: { key: productKey },
    select: { id: true, name: true, enabled: true },
  })
  if (!product || !product.enabled) {
    return NextResponse.json({ error: "产品不存在或已下架" }, { status: 404 })
  }
  const plans = await prisma.membershipPlan.findMany({
    where: { enabled: true, productId: product.id },
    orderBy: { sortOrder: "asc" },
  })
  const member = await getCurrentMember()
  const upgradeQuote = member && !member.disabled
    ? await getLifetimeUpgradeQuote(member.id, product.id)
    : null
  return NextResponse.json({
    name: product.name,
    plans: plans.map((p) => ({
      key: p.key,
      name: p.name,
      price: Number(p.price),
      originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
      durationDays: p.durationDays,
      badge: p.badge,
      recommended: p.recommended,
      upgradeCredit: p.durationDays == null && upgradeQuote?.eligible ? upgradeQuote.creditYuan : 0,
      upgradeCreditRaw: p.durationDays == null && upgradeQuote?.eligible ? upgradeQuote.rawCreditYuan : 0,
      upgradeUnusedDays: p.durationDays == null && upgradeQuote?.eligible ? upgradeQuote.unusedDays : 0,
    })),
  })
}
