/** 纯函数自检（项目无单测框架，用 tsx 跑断言代替）。Run: npx tsx scripts/check-promo.ts */
import { normalizePromoCode, zheToPercentOff, percentOffToZhe, discountedYuan } from "@/lib/promo"

function eq(label: string, got: unknown, want: unknown) {
  const ok = got === want
  console.log(`${ok ? "✓" : "✗"} ${label}: got ${got}${ok ? "" : ` want ${want}`}`)
  if (!ok) process.exitCode = 1
}

eq("normalize 去空格大写", normalizePromoCode("  welcome20 "), "WELCOME20")
eq("normalize 中文不变", normalizePromoCode(" 新用户 "), "新用户".toUpperCase())
eq("折→% 8折", zheToPercentOff(8), 20)
eq("折→% 8.5折", zheToPercentOff(8.5), 15)
eq("%→折 20", percentOffToZhe(20), 8)
eq("%→折 15", percentOffToZhe(15), 8.5)
eq("8折 ¥3.9 → 3", discountedYuan(3.9, 20), 3)
eq("8折 ¥29 → 23", discountedYuan(29, 20), 23)
eq("8折 ¥9.9 → 7", discountedYuan(9.9, 20), 7)
eq("8折 ¥69 → 55", discountedYuan(69, 20), 55)
eq("9折 ¥3.9 → 3(3.51 向下取整)", discountedYuan(3.9, 10), 3)
console.log(process.exitCode ? "FAIL" : "ALL PASS")
