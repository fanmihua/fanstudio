import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentMember } from "@/lib/require-member"
import { checkPromoCode, discountedYuan } from "@/lib/promo"
import { checkRouteRateLimit, rateLimitJson } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/** POST: 登录会员校验兑换码。body: { code, product }。
 * 通过 → { ok:true, codeText, percentOff, plans:[{key,name,originalPrice,finalPrice}] }（仅适用套餐）。
 * 不通过 → { ok:false, error }。 */
export async function POST(request: NextRequest) {
  const ipLimit = checkRouteRateLimit(request, { namespace: "mbr-coupon-ip", limit: 30, windowMs: 60_000 })
  if (!ipLimit.ok) return rateLimitJson(ipLimit.retryAfter)

  const member = await getCurrentMember()
  if (!member || member.disabled) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 })
  const memberLimit = checkRouteRateLimit(request, {
    namespace: "mbr-coupon-member",
    key: member.id,
    limit: 12,
    windowMs: 60_000,
  })
  if (!memberLimit.ok) return rateLimitJson(memberLimit.retryAfter)

  let body: { code?: string; product?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "请求体格式错误" }, { status: 400 })
  }

  const productKey = body.product?.trim() || ""
  if (!productKey) return NextResponse.json({ ok: false, error: "缺少产品标识" }, { status: 400 })
  const product = await prisma.product.findUnique({ where: { key: productKey } })
  if (!product || !product.enabled) return NextResponse.json({ ok: false, error: "产品不存在或已下架" }, { status: 404 })

  const check = await checkPromoCode({ rawCode: body.code || "", productId: product.id, memberId: member.id })
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 200 })

  // 仅在售套餐；若码限定了 planKey 则只取该套餐
  const plans = await prisma.membershipPlan.findMany({
    where: {
      productId: product.id,
      enabled: true,
      ...(check.planKey ? { key: check.planKey } : {}),
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json({
    ok: true,
    codeText: check.codeText,
    percentOff: check.percentOff,
    plans: plans.map((p) => ({
      key: p.key,
      name: p.name,
      originalPrice: Number(p.price),
      finalPrice: discountedYuan(Number(p.price), check.percentOff),
    })),
  })
}
