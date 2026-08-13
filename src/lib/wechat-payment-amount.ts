export type WechatPaidAmount = {
  total?: number
  payer_total?: number
}

export type WechatAmountValidation =
  | { ok: true }
  | { ok: false; error: string }

export function yuanToFen(amountYuan: number): number {
  return Math.round(amountYuan * 100)
}

export function validateWechatPaidAmount(
  expectedAmountYuan: number,
  paidAmount: WechatPaidAmount | undefined | null,
): WechatAmountValidation {
  const expectedFen = yuanToFen(expectedAmountYuan)
  const actualFen = paidAmount?.total ?? paidAmount?.payer_total
  if (!Number.isInteger(expectedFen) || expectedFen <= 0) {
    return { ok: false, error: "本地订单金额异常" }
  }
  if (typeof actualFen !== "number" || !Number.isInteger(actualFen) || actualFen <= 0) {
    return { ok: false, error: "微信支付金额缺失" }
  }
  if (actualFen !== expectedFen) {
    return { ok: false, error: `支付金额不一致：应收 ${expectedFen} 分，实收 ${actualFen} 分` }
  }
  return { ok: true }
}
