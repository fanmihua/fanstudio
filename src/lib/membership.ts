/**
 * 会员订单 / 权益共享逻辑。授予/赠送/撤销/改期/封禁/退款回扣 全部作用于 Entitlement。
 * 微信回调与开发模拟支付共用 applyPaidMembershipOrder，保证授予逻辑一处维护。
 */
import { randomBytes } from "crypto"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import type { Entitlement, Member, MembershipOrder, MembershipOrderSource } from "@prisma/client"

const DAY_MS = 86_400_000

/** 生成会员订单号：MBR + 时间戳 + 6 位随机（与作品订单 ORD 前缀区分）。 */
export function generateMembershipOrderNo(): string {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)
  return `MBR${ts}${randomBytes(3).toString("hex")}`
}

/** 计算续期后的到期时间：未过期则从现有有效期续，否则从现在起算。 */
function extendExpiry(current: Date | null | undefined, days: number): Date {
  const now = new Date()
  const base = current && current > now ? current : now
  return new Date(base.getTime() + days * 86400_000)
}

type UpgradeCreditOrder = {
  source?: MembershipOrderSource
  amount: Prisma.Decimal | number
  grantsDays: number | null
  paidAt: Date | null
  createdAt?: Date | null
}

export type LifetimeUpgradeQuote = {
  eligible: boolean
  creditYuan: number
  rawCreditYuan: number
  unusedDays: number
  eligibleOrderCount: number
}

export function calculateLifetimeUpgradeCredit(
  orders: UpgradeCreditOrder[],
  now = new Date(),
): Omit<LifetimeUpgradeQuote, "eligible"> {
  let cursor: Date | null = null
  let rawCredit = 0
  let unusedMsTotal = 0
  let eligibleOrderCount = 0

  for (const order of orders) {
    const days = order.grantsDays ?? 0
    if (days <= 0) continue

    const paidAt = order.paidAt ?? order.createdAt ?? now
    const start: Date = cursor && cursor > paidAt ? cursor : paidAt
    const end: Date = new Date(start.getTime() + days * DAY_MS)
    cursor = end
    if (end <= now) continue

    const unusedStart = start > now ? start : now
    const unusedMs = Math.max(0, end.getTime() - unusedStart.getTime())
    if (unusedMs <= 0) continue

    const amount = Number(order.amount)
    const isPaidPurchase = (order.source ?? "PURCHASE") === "PURCHASE"
    if (!isPaidPurchase || !Number.isFinite(amount) || amount <= 0) continue

    rawCredit += amount * (unusedMs / (days * DAY_MS))
    unusedMsTotal += unusedMs
    eligibleOrderCount += 1
  }

  return {
    creditYuan: Math.max(0, Math.floor(rawCredit + 1e-6)),
    rawCreditYuan: Math.round(rawCredit * 100) / 100,
    unusedDays: Math.ceil(unusedMsTotal / DAY_MS),
    eligibleOrderCount,
  }
}

export async function getLifetimeUpgradeQuote(
  memberId: string,
  productId: string,
  now = new Date(),
): Promise<LifetimeUpgradeQuote> {
  const current = await prisma.entitlement.findUnique({
    where: { memberId_productId: { memberId, productId } },
    select: { isLifetime: true, expiresAt: true, revokedAt: true },
  })
  if (!current || current.revokedAt || current.isLifetime || !current.expiresAt || current.expiresAt <= now) {
    return { eligible: false, creditYuan: 0, rawCreditYuan: 0, unusedDays: 0, eligibleOrderCount: 0 }
  }

  const orders = await prisma.membershipOrder.findMany({
    where: {
      memberId,
      productId,
      status: "PAID",
      isLifetime: false,
      grantsDays: { not: null },
    },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: { source: true, amount: true, grantsDays: true, paidAt: true, createdAt: true },
  })
  const credit = calculateLifetimeUpgradeCredit(orders, now)
  return { eligible: true, ...credit }
}

export type ApplyPaidResult =
  | { ok: false; reason: "not_found" | "bad_status" | "no_member" }
  | { ok: true; newlyPaid: boolean; isRenewal: boolean; order: MembershipOrder; entitlement: Entitlement | null }

/**
 * 幂等：把会员订单标记为已支付并授予对应产品权益。
 * 已是 PAID 直接返回（newlyPaid=false）；非 PENDING/PAID 视为非法。
 */
export async function applyPaidMembershipOrder(
  orderNo: string,
  paymentId?: string | null,
): Promise<ApplyPaidResult> {
  return prisma.$transaction(async (tx) => {
    const initial = await tx.membershipOrder.findUnique({ where: { orderNo } })
    if (!initial) return { ok: false, reason: "not_found" }

    // 同一会员可能出现多个支付回调同时到达。锁住会员行，让同一会员的
    // 权益续期串行计算，避免并发读取同一个 expiresAt 后互相覆盖。
    await tx.$queryRaw`SELECT id FROM \`Member\` WHERE id = ${initial.memberId} FOR UPDATE`

    const order = await tx.membershipOrder.findUnique({ where: { orderNo } })
    if (!order) return { ok: false, reason: "not_found" }
    const member = await tx.member.findUnique({ where: { id: order.memberId } })
    if (!member) return { ok: false, reason: "no_member" }

    const key = { memberId_productId: { memberId: order.memberId, productId: order.productId } }

    if (order.status === "PAID") {
      const existing = await tx.entitlement.findUnique({ where: key })
      return { ok: true, newlyPaid: false, isRenewal: false, order, entitlement: existing }
    }
    if (order.status !== "PENDING") return { ok: false, reason: "bad_status" }

    const current = await tx.entitlement.findUnique({ where: key })
    const wasRenewal = !!current // 之前已有该产品权益记录 → 续期/延长
    if (current?.isLifetime && !current.revokedAt) {
      const updatedOrder = await tx.membershipOrder.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: new Date(), paymentId: paymentId ?? order.paymentId ?? null },
      })
      if (order.promoCodeId) {
        await tx.promoCode.update({
          where: { id: order.promoCodeId },
          data: { redeemedCount: { increment: 1 } },
        })
      }
      return { ok: true, newlyPaid: true, isRenewal: true, order: updatedOrder, entitlement: current }
    }
    const isLifetime = !!order.isLifetime
    const expiresAt = isLifetime ? null : extendExpiry(current?.expiresAt, order.grantsDays ?? 0)

    const entitlement = await tx.entitlement.upsert({
      where: key,
      update: { isLifetime, expiresAt, revokedAt: null, source: "PURCHASE", sourceOrderId: order.orderNo },
      create: {
        memberId: order.memberId,
        productId: order.productId,
        isLifetime,
        expiresAt,
        source: "PURCHASE",
        sourceOrderId: order.orderNo,
      },
    })
    const updatedOrder = await tx.membershipOrder.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), paymentId: paymentId ?? order.paymentId ?? null },
    })
    // 折扣码：仅在本单首次转 PAID 时计数 +1（已 PAID 的重复回调在上方已提前 return，天然幂等）
    if (order.promoCodeId) {
      await tx.promoCode.update({
        where: { id: order.promoCodeId },
        data: { redeemedCount: { increment: 1 } },
      })
    }
    return { ok: true, newlyPaid: true, isRenewal: wasRenewal, order: updatedOrder, entitlement }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })
}

/**
 * 后台赠送开通：按邮箱认领/新建会员 → 写/续该产品权益
 * → 记一条 ¥0 的 COMP 订单作为审计与来源标记。days=null 表示永久。
 */
export async function grantMembership(opts: {
  productId: string
  email: string
  days: number | null
  note?: string | null
}): Promise<{ member: Member; entitlement: Entitlement; isRenewal: boolean }> {
  const email = opts.email.trim().toLowerCase()
  const isLifetime = opts.days == null
  return prisma.$transaction(async (tx) => {
    const member = await tx.member.upsert({ where: { email }, update: { archivedAt: null }, create: { email } })
    const key = { memberId_productId: { memberId: member.id, productId: opts.productId } }
    const current = await tx.entitlement.findUnique({ where: key })
    const isRenewal = !!current // 之前已有该产品权益 → 续期/延长（用于通知文案）
    const expiresAt = isLifetime ? null : extendExpiry(current?.expiresAt, opts.days ?? 0)

    const entitlement = await tx.entitlement.upsert({
      where: key,
      update: { isLifetime, expiresAt, revokedAt: null, source: "COMP", note: opts.note ?? null },
      create: {
        memberId: member.id,
        productId: opts.productId,
        isLifetime,
        expiresAt,
        source: "COMP",
        note: opts.note ?? null,
      },
    })
    await tx.membershipOrder.create({
      data: {
        orderNo: generateMembershipOrderNo(),
        memberId: member.id,
        productId: opts.productId,
        planKey: null,
        planName: isLifetime ? "赠送通行" : `赠送 · ${opts.days} 天`,
        source: "COMP",
        amount: 0,
        status: "PAID",
        grantsDays: isLifetime ? null : opts.days,
        isLifetime,
        buyerEmail: email,
        paidAt: new Date(),
        note: opts.note ?? null,
      },
    })
    return { member, entitlement, isRenewal }
  })
}

/** 撤销某会员对某产品的权益（不退款，立即失效）。 */
export async function revokeEntitlement(memberId: string, productId: string): Promise<void> {
  await prisma.entitlement.updateMany({
    where: { memberId, productId },
    data: { revokedAt: new Date() },
  })
}

/** 改有效期：days>0 设为 now+days；days=null 置永久；days<=0 立即过期。 */
export async function adjustEntitlement(
  memberId: string,
  productId: string,
  days: number | null,
): Promise<void> {
  const now = new Date()
  const data =
    days == null
      ? { isLifetime: true, expiresAt: null, revokedAt: null }
      : {
          isLifetime: false,
          expiresAt: new Date(now.getTime() + days * 86400_000),
          revokedAt: days > 0 ? null : new Date(),
        }
  await prisma.entitlement.updateMany({ where: { memberId, productId }, data })
}

/** 封禁 / 解禁整个会员账号。 */
export async function setMemberDisabled(memberId: string, disabled: boolean): Promise<void> {
  await prisma.member.update({ where: { id: memberId }, data: { disabled } })
}

/**
 * 退款回扣：用「该会员该产品所有仍有效(PAID 且非本退款单)的订单」按 paidAt 顺序**重算**权益。
 * 比"单条权益直接减本单天数"健壮——多次购买/续费后再退款也正确（单条权益无法溯源各单贡献）。
 * 无任何剩余有效订单则撤销权益。退款单应在调用前已标 REFUNDED（双保险：status=PAID + 排除本单 id）。
 */
export async function revertEntitlementForRefund(order: {
  id: string
  memberId: string
  productId: string
}): Promise<void> {
  const key = { memberId_productId: { memberId: order.memberId, productId: order.productId } }
  const ent = await prisma.entitlement.findUnique({ where: key })
  if (!ent) return

  const remaining = await prisma.membershipOrder.findMany({
    where: { memberId: order.memberId, productId: order.productId, status: "PAID", NOT: { id: order.id } },
    orderBy: { paidAt: "asc" },
    select: { grantsDays: true, isLifetime: true, paidAt: true },
  })

  if (remaining.length === 0) {
    await prisma.entitlement.update({ where: { id: ent.id }, data: { revokedAt: new Date() } })
    return
  }

  // 按历史顺序重放：遇永久则置永久；否则以各单 paidAt 为参考，未过期续、已过期重算
  let lifetime = false
  let expiresAt: Date | null = null
  for (const o of remaining) {
    if (o.isLifetime) {
      lifetime = true
      expiresAt = null
    } else if (!lifetime) {
      const at = o.paidAt ?? new Date()
      const base: Date = expiresAt && expiresAt > at ? expiresAt : at
      expiresAt = new Date(base.getTime() + (o.grantsDays ?? 0) * 86400_000)
    }
  }
  await prisma.entitlement.update({
    where: { id: ent.id },
    data: { isLifetime: lifetime, expiresAt: lifetime ? null : expiresAt, revokedAt: null },
  })
}
