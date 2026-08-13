import { NextRequest, NextResponse } from "next/server"
import { getCurrentMember, memberHasProductAccess } from "@/lib/require-member"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET: 当前登录会员（未登录或被封禁返回 { member: null }）。
 *  传 ?product=<key> 时附带该产品是否拥有有效权益 access。
 *  始终返回 entitlements[] 概要（会员中心用；老调用忽略即可）。 */
export async function GET(request: NextRequest) {
  const member = await getCurrentMember()
  if (!member || member.disabled) {
    return NextResponse.json({ member: null, access: false, entitlements: [] })
  }
  const product = new URL(request.url).searchParams.get("product")?.trim()
  const access = product ? await memberHasProductAccess(member, product) : false
  const hasPromoUsage = product
    ? await prisma.membershipOrder.count({
        where: {
          memberId: member.id,
          source: "PURCHASE",
          status: "PAID",
          promoCodeText: { not: null },
          product: { key: product },
        },
      })
    : 0

  const now = new Date()
  const ents = await prisma.entitlement.findMany({
    where: { memberId: member.id },
    select: {
      isLifetime: true,
      expiresAt: true,
      revokedAt: true,
      source: true,
      product: { select: { key: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  const entitlements = ents.map((e) => ({
    productKey: e.product.key,
    productName: e.product.name,
    isLifetime: e.isLifetime,
    expiresAt: e.expiresAt,
    source: e.source,
    active: !e.revokedAt && (e.isLifetime || (!!e.expiresAt && e.expiresAt > now)),
    revoked: !!e.revokedAt,
  }))

  return NextResponse.json({
    member: { id: member.id, email: member.email, name: member.name },
    access,
    hasPromoUsage: hasPromoUsage > 0,
    entitlements,
  })
}
