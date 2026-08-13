/**
 * 会员折扣码核心逻辑。折扣金额一律服务端计算（前台/下单/校验共用），绝不信前端。
 * 折扣先按分计算，再向下取整到元，避免结算页出现小数金额。
 */
import type { MembershipPlanKey } from "@prisma/client"
import prisma from "@/lib/prisma"

/** 规范化码串：去首尾空格 + 转大写（中文不受影响）。存储与比对都用规范化形式。 */
export function normalizePromoCode(raw: string): string {
  return (raw ?? "").trim().toUpperCase()
}

/** 「几折」→ 立减百分比。8 → 20；8.5 → 15。范围 [0.1, 9.9]。 */
export function zheToPercentOff(zhe: number): number {
  return Math.round((10 - zhe) * 10)
}

/** 立减百分比 →「几折」（后台回显用）。20 → 8；15 → 8.5。 */
export function percentOffToZhe(percentOff: number): number {
  return Math.round((100 - percentOff) * 10) / 100
}

/** 折后价（元，向下取整到整元）。priceYuan 原价元，percentOff 立减百分比。 */
export function discountedYuan(priceYuan: number, percentOff: number): number {
  const cents = Math.round(priceYuan * 100)
  const finalCents = Math.round((cents * (100 - percentOff)) / 100)
  return Math.floor(finalCents / 100) // 向下取整到整元，去掉小数（如 8 折 ¥3.9→¥3、¥29→¥23）
}

export type PromoCheckOk = {
  ok: true
  codeId: string
  codeText: string
  percentOff: number
  /** 适用套餐 key；null = 全场 */
  planKey: MembershipPlanKey | null
}
export type PromoCheck = PromoCheckOk | { ok: false; error: string }

/**
 * 校验某会员能否对某产品使用某折扣码。通过返回 percentOff/适用范围；不通过返回中文报错。
 * 不在此处算具体套餐价（调用方按 discountedYuan 算），只判定资格 + 折扣力度 + 适用套餐。
 */
export async function checkPromoCode(opts: {
  rawCode: string
  productId: string
  memberId: string
}): Promise<PromoCheck> {
  const codeText = normalizePromoCode(opts.rawCode)
  if (!codeText) return { ok: false, error: "请输入兑换码" }

  const promo = await prisma.promoCode.findUnique({ where: { code: codeText } })
  if (!promo || !promo.enabled) return { ok: false, error: "兑换码无效" }
  if (promo.productId !== opts.productId) return { ok: false, error: "兑换码不适用当前产品" }

  const now = new Date()
  if (promo.startsAt && promo.startsAt > now) return { ok: false, error: "兑换码尚未生效" }
  if (promo.expiresAt && promo.expiresAt < now) return { ok: false, error: "兑换码已过期" }
  if (promo.maxRedemptions != null) {
    // 总量上限 = 已核销(PAID) + 在途占位(近窗口内 PENDING)。
    // redeemedCount 在支付回调时才 +1，若只比它会留下「下单时检查、支付时才核销」长达数分钟的并发超卖窗口；
    // 把在途未支付订单一起计入，可把该窗口收窄到下单事务内 count→create 的毫秒级。
    // 未支付订单会过期 / 被 cleanup 脚本回收，故占位是临时且自愈的。
    const HOLD_WINDOW_MS = 30 * 60_000
    const pendingHolds = await prisma.membershipOrder.count({
      where: {
        promoCodeId: promo.id,
        status: "PENDING",
        createdAt: { gt: new Date(Date.now() - HOLD_WINDOW_MS) },
      },
    })
    if (promo.redeemedCount + pendingHolds >= promo.maxRedemptions) {
      return { ok: false, error: "兑换码已被领完" }
    }
  }

  // 每个会员对同一产品只允许成功使用一次兑换码；未支付订单不计入。
  const used = await prisma.membershipOrder.count({
    where: {
      memberId: opts.memberId,
      productId: opts.productId,
      source: "PURCHASE",
      status: "PAID",
      promoCodeText: { not: null },
    },
  })
  if (used > 0) return { ok: false, error: "你已使用过兑换码" }

  return { ok: true, codeId: promo.id, codeText, percentOff: promo.percentOff, planKey: promo.planKey }
}
