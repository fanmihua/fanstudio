import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { grantMembership } from "@/lib/membership"
import { sendMembershipEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function entActive(e: { revokedAt: Date | null; isLifetime: boolean; expiresAt: Date | null }): boolean {
  if (e.revokedAt) return false
  if (e.isLifetime) return true
  return !!e.expiresAt && e.expiresAt.getTime() > Date.now()
}

/** GET: 会员列表（含各产品权益、来源、封禁态）。 */
export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  const archive = new URL(request.url).searchParams.get("archive") || "active"
  const where = archive === "archived" ? { archivedAt: { not: null } } : archive === "all" ? {} : { archivedAt: null }

  const members = await prisma.member.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      entitlements: { include: { product: { select: { key: true, name: true } } } },
      orders: {
        where: { status: "PAID", source: "PURCHASE", promoCodeText: { not: null } },
        orderBy: { paidAt: "desc" },
        take: 10,
        select: { orderNo: true, planName: true, amount: true, paidAt: true, promoCodeText: true },
      },
    },
  })

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      disabled: m.disabled,
      archivedAt: m.archivedAt,
      createdAt: m.createdAt,
      entitlements: m.entitlements.map((e) => ({
        productKey: e.product.key,
        productName: e.product.name,
        active: !m.disabled && !m.archivedAt && entActive(e),
        isLifetime: e.isLifetime,
        expiresAt: e.expiresAt,
        revokedAt: e.revokedAt,
        source: e.source,
      })),
      promoUsages: m.orders
        .filter((o) => o.promoCodeText)
        .map((o) => ({
          code: o.promoCodeText,
          orderNo: o.orderNo,
          planName: o.planName,
          amount: Number(o.amount),
          paidAt: o.paidAt,
        })),
    })),
  )
}

/** POST: 赠送开通（单个或批量）。body: { emails: string[], productKey, days: number|null(永久), note? }。 */
export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  let body: { emails?: unknown; productKey?: unknown; days?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 })
  }

  const productKey = typeof body.productKey === "string" ? body.productKey.trim() : ""
  if (!productKey) return NextResponse.json({ error: "缺少产品标识" }, { status: 400 })
  const product = await prisma.product.findUnique({ where: { key: productKey } })
  if (!product) {
    return NextResponse.json({ error: "产品不存在" }, { status: 404 })
  }

  const rawEmails = Array.isArray(body.emails) ? body.emails : []
  const note = typeof body.note === "string" ? body.note.trim() || null : null

  let days: number | null
  if (body.days == null) days = null
  else {
    const n = Number(body.days)
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "天数无效（留空=永久）" }, { status: 400 })
    }
    days = n
  }

  const valid: string[] = []
  const invalid: string[] = []
  for (const e of rawEmails) {
    const email = typeof e === "string" ? e.trim().toLowerCase() : ""
    if (email && EMAIL_RE.test(email)) valid.push(email)
    else if (email) invalid.push(email)
  }
  const unique = Array.from(new Set(valid))
  if (unique.length === 0) {
    return NextResponse.json({ error: "没有有效的邮箱", invalid }, { status: 400 })
  }

  const settings = await prisma.settings.findUnique({ where: { id: "settings" }, select: { siteName: true } })
  const siteName = normalizeSiteName(settings?.siteName)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || ""
  const startUrl = siteUrl && product.landingPath ? `${siteUrl}${product.landingPath}` : null

  for (const email of unique) {
    const res = await grantMembership({ productId: product.id, email, days, note })
    // 赠送通知邮件（不阻塞响应；未配 SMTP 静默跳过）
    sendMembershipEmail({
      to: email,
      siteName,
      productName: product.name,
      source: "COMP",
      isRenewal: res.isRenewal,
      isLifetime: days == null,
      isLifetimeOrder: days == null,
      accessUntil: res.entitlement.expiresAt,
      planName: days == null ? "永久" : `${days} 天`,
      note,
      startUrl,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, granted: unique.length, invalid })
}
