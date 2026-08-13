/**
 * 会员生命周期端到端测试（直打真实 lib + DB，绕过鉴权/微信）。
 * 覆盖：赠送/续期/到期/改期/永久/撤销/复购/封禁解禁/模拟支付幂等/并发回调/兑换码/多产品/全站通/退款重算。
 * 用法：MEMBERSHIP_TEST_ALLOW_WRITE=1 npm run test:membership（自建自清 mtest- 数据）
 */
import prisma from "@/lib/prisma"
import {
  grantMembership,
  applyPaidMembershipOrder,
  calculateLifetimeUpgradeCredit,
  revokeEntitlement,
  adjustEntitlement,
  setMemberDisabled,
  revertEntitlementForRefund,
  generateMembershipOrderNo,
  getLifetimeUpgradeQuote,
} from "@/lib/membership"
import { memberHasProductAccess } from "@/lib/require-member"
import { createMemberSession, createMemberSessionToken, MEMBER_COOKIE_NAME } from "@/lib/member-session"
import { checkPromoCode } from "@/lib/promo"

if (process.env.MEMBERSHIP_TEST_ALLOW_WRITE !== "1") {
  throw new Error("会员集成测试会写入数据库；请确认使用隔离测试库并设置 MEMBERSHIP_TEST_ALLOW_WRITE=1")
}

const DAY = 86_400_000
const PRIMARY_TEST_PRODUCT_KEY = "mtest-primary"
const TEST_PRODUCT_KEYS = [
  PRIMARY_TEST_PRODUCT_KEY,
  "mtest-all",
  "mtest-other",
  "mtest-upgrade",
  "mtest-isolated-a",
  "mtest-isolated-b",
]
let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++
    console.log("  ✅", name, detail)
  } else {
    fail++
    console.log("  ❌ FAIL", name, detail)
  }
}
const near = (d: number | null, target: number) => d != null && Math.abs(d - target) <= 1
const daysLeft = (d: Date | null) => (d ? Math.round((d.getTime() - Date.now()) / DAY) : null)

async function access(memberId: string, key = PRIMARY_TEST_PRODUCT_KEY) {
  const m = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, disabled: true, archivedAt: true },
  })
  return memberHasProductAccess(m, key)
}
async function ent(memberId: string, productId: string) {
  return prisma.entitlement.findUnique({ where: { memberId_productId: { memberId, productId } } })
}

async function cleanup() {
  const ms = await prisma.member.findMany({ where: { email: { startsWith: "mtest-" } }, select: { id: true } })
  const ids = ms.map((m) => m.id)
  if (ids.length) {
    await prisma.entitlement.deleteMany({ where: { memberId: { in: ids } } })
    await prisma.membershipOrder.deleteMany({ where: { memberId: { in: ids } } })
    await prisma.membershipEvent.deleteMany({ where: { memberId: { in: ids } } })
    await prisma.member.deleteMany({ where: { id: { in: ids } } })
  }
  await prisma.membershipEvent.deleteMany({ where: { email: { startsWith: "mtest-" } } })
  await prisma.entitlement.deleteMany({ where: { product: { key: { in: TEST_PRODUCT_KEYS } } } })
  await prisma.membershipOrder.deleteMany({ where: { product: { key: { in: TEST_PRODUCT_KEYS } } } })
  await prisma.promoCode.deleteMany({ where: { product: { key: { in: TEST_PRODUCT_KEYS } } } })
  await prisma.membershipPlan.deleteMany({ where: { product: { key: { in: TEST_PRODUCT_KEYS } } } })
  await prisma.product.deleteMany({ where: { key: { in: TEST_PRODUCT_KEYS } } })
}

async function makePaidOrder(memberId: string, productId: string, days: number, paidAgoDays = 0, amount = 29) {
  const orderNo = generateMembershipOrderNo()
  await prisma.membershipOrder.create({
    data: {
      orderNo,
      memberId,
      productId,
      planKey: "YEAR",
      planName: `测试 ${days} 天`,
      source: "PURCHASE",
      amount,
      status: "PAID",
      grantsDays: days,
      isLifetime: false,
      buyerEmail: "mtest-direct@local.test",
      paidAt: new Date(Date.now() - paidAgoDays * DAY),
    },
  })
  return orderNo
}

async function makePendingOrder(opts: {
  memberId: string
  productId: string
  planKey: "MONTH" | "QUARTER" | "YEAR" | "LIFETIME"
  planName: string
  amount: number
  days: number | null
  email: string
}) {
  const orderNo = generateMembershipOrderNo()
  await prisma.membershipOrder.create({
    data: {
      orderNo,
      memberId: opts.memberId,
      productId: opts.productId,
      planKey: opts.planKey,
      planName: opts.planName,
      source: "PURCHASE",
      amount: opts.amount,
      status: "PENDING",
      grantsDays: opts.days,
      isLifetime: opts.days == null,
      buyerEmail: opts.email,
    },
  })
  return orderNo
}

async function memberCookie(memberId: string) {
  const sid = await createMemberSession(memberId, { userAgent: "membership-test", ip: "127.0.0.1" })
  return `${MEMBER_COOKIE_NAME}=${createMemberSessionToken(memberId, sid)}`
}

async function postCreateOrder(cookie: string | null, body: Record<string, unknown>) {
  const base = process.env.MEMBERSHIP_TEST_BASE || "http://localhost:3001"
  return fetch(`${base}/api/membership/order/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function getPlans(cookie: string | null, product: string) {
  const base = process.env.MEMBERSHIP_TEST_BASE || "http://localhost:3001"
  return fetch(`${base}/api/membership/plans?product=${encodeURIComponent(product)}`, {
    headers: cookie ? { Cookie: cookie } : {},
  })
}

async function getMemberMe(cookie: string | null, product: string) {
  const base = process.env.MEMBERSHIP_TEST_BASE || "http://localhost:3001"
  return fetch(`${base}/api/member/me?product=${encodeURIComponent(product)}`, {
    headers: cookie ? { Cookie: cookie } : {},
  })
}

async function createUpgradeTestProduct() {
  const product = await prisma.product.create({ data: { key: "mtest-upgrade", name: "升级测试", enabled: true } })
  await prisma.membershipPlan.createMany({
    data: [
      { productId: product.id, key: "MONTH", name: "一个月", price: 3.9, durationDays: 30, enabled: true, sortOrder: 1 },
      { productId: product.id, key: "YEAR", name: "一年", price: 29, durationDays: 365, enabled: true, sortOrder: 2 },
      { productId: product.id, key: "LIFETIME", name: "永久", price: 69, durationDays: null, enabled: true, sortOrder: 3 },
    ],
  })
  return product
}

async function createPrimaryTestProduct() {
  const product = await prisma.product.upsert({
    where: { key: PRIMARY_TEST_PRODUCT_KEY },
    update: { name: "主测试产品", enabled: true, isAllAccess: false },
    create: { key: PRIMARY_TEST_PRODUCT_KEY, name: "主测试产品", enabled: true },
  })
  const plans = [
    { key: "MONTH" as const, name: "一个月", price: 3.9, durationDays: 30, sortOrder: 1 },
    { key: "QUARTER" as const, name: "三个月", price: 8.9, durationDays: 90, sortOrder: 2 },
    { key: "YEAR" as const, name: "一年", price: 29, durationDays: 365, sortOrder: 3 },
    { key: "LIFETIME" as const, name: "永久", price: 69, durationDays: null, sortOrder: 4 },
  ]
  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { productId_key: { productId: product.id, key: plan.key } },
      update: {
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
        enabled: true,
        sortOrder: plan.sortOrder,
      },
      create: {
        productId: product.id,
        key: plan.key,
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
        enabled: true,
        sortOrder: plan.sortOrder,
      },
    })
  }
  return product
}

async function main() {
  await cleanup()
  const primaryProduct = await createPrimaryTestProduct()

  console.log("\n— 赠送 / 续费 / 永久 —")
  const g = await grantMembership({ productId: primaryProduct.id, email: "mtest-1@local.test", days: 30 })
  const mid = g.member.id
  check("赠送30天 → 可访问 + ≈30天", (await access(mid)) && near(daysLeft((await ent(mid, primaryProduct.id))!.expiresAt), 30), `${daysLeft((await ent(mid, primaryProduct.id))!.expiresAt)}d`)
  await grantMembership({ productId: primaryProduct.id, email: "mtest-1@local.test", days: 365 })
  check("续费(未过期叠加) → ≈395天", near(daysLeft((await ent(mid, primaryProduct.id))!.expiresAt), 395), `${daysLeft((await ent(mid, primaryProduct.id))!.expiresAt)}d`)

  console.log("\n— 改期 / 到期 / 撤销 —")
  await adjustEntitlement(mid, primaryProduct.id, 0)
  check("改期=0(立即过期) → 不可访问", !(await access(mid)))
  await adjustEntitlement(mid, primaryProduct.id, 90)
  check("改期=90 → 可访问 + ≈90天", (await access(mid)) && near(daysLeft((await ent(mid, primaryProduct.id))!.expiresAt), 90))
  await adjustEntitlement(mid, primaryProduct.id, null)
  check("改期=null(永久) → 可访问 + isLifetime", (await access(mid)) && (await ent(mid, primaryProduct.id))!.isLifetime && (await ent(mid, primaryProduct.id))!.expiresAt === null)
  await revokeEntitlement(mid, primaryProduct.id)
  check("撤销 → 不可访问", !(await access(mid)))
  await grantMembership({ productId: primaryProduct.id, email: "mtest-1@local.test", days: 30 })
  check("撤销后复授 → 恢复访问", await access(mid))

  console.log("\n— 封禁 / 解禁 —")
  await setMemberDisabled(mid, true)
  check("封禁 → 有权益也不可访问", !(await access(mid)))
  await setMemberDisabled(mid, false)
  check("解禁 → 恢复访问", await access(mid))

  console.log("\n— 模拟支付 + 幂等 —")
  const orderNo = generateMembershipOrderNo()
  const m2 = await prisma.member.create({ data: { email: "mtest-pay@local.test" } })
  await prisma.membershipOrder.create({
    data: { orderNo, memberId: m2.id, productId: primaryProduct.id, planKey: "YEAR", planName: "一年", source: "PURCHASE", amount: 29, status: "PENDING", grantsDays: 365, isLifetime: false, buyerEmail: "mtest-pay@local.test" },
  })
  const r1 = await applyPaidMembershipOrder(orderNo, "TEST-PAY")
  check("模拟支付 → 授权 + 可访问 + ≈365天", r1.ok && r1.newlyPaid === true && (await access(m2.id)) && near(daysLeft((await ent(m2.id, primaryProduct.id))!.expiresAt), 365))
  const r2 = await applyPaidMembershipOrder(orderNo, "TEST-PAY")
  check("回调重放(幂等) → 不重复授权(仍≈365天)", r2.ok && r2.newlyPaid === false && near(daysLeft((await ent(m2.id, primaryProduct.id))!.expiresAt), 365), `${daysLeft((await ent(m2.id, primaryProduct.id))!.expiresAt)}d`)
  const ord = await prisma.membershipOrder.findUniqueOrThrow({ where: { orderNo } })
  check("价格/时长快照: 订单存 amount=29 / grantsDays=365", Number(ord.amount) === 29 && ord.grantsDays === 365)

  console.log("\n— 并发回调防覆盖 —")
  const mConcurrent = await prisma.member.create({ data: { email: "mtest-concurrent@local.test" } })
  const concurrentMonth = await makePendingOrder({
    memberId: mConcurrent.id,
    productId: primaryProduct.id,
    planKey: "MONTH",
    planName: "一个月",
    amount: 3.9,
    days: 30,
    email: "mtest-concurrent@local.test",
  })
  const concurrentYear = await makePendingOrder({
    memberId: mConcurrent.id,
    productId: primaryProduct.id,
    planKey: "YEAR",
    planName: "一年",
    amount: 29,
    days: 365,
    email: "mtest-concurrent@local.test",
  })
  const concurrentResults = await Promise.all([
    applyPaidMembershipOrder(concurrentMonth, "TEST-CONCURRENT-MONTH"),
    applyPaidMembershipOrder(concurrentYear, "TEST-CONCURRENT-YEAR"),
  ])
  check(
    "同一会员两笔支付回调并发到达 → 有效期串行叠加",
    concurrentResults.every((res) => res.ok && res.newlyPaid === true) &&
      near(daysLeft((await ent(mConcurrent.id, primaryProduct.id))!.expiresAt), 395),
    `${daysLeft((await ent(mConcurrent.id, primaryProduct.id))!.expiresAt)}d`,
  )

  console.log("\n— 付费续期 / 升级 / 永久防降级 —")
  const mRenew = await prisma.member.create({ data: { email: "mtest-renew@local.test" } })
  await prisma.entitlement.create({
    data: {
      memberId: mRenew.id,
      productId: primaryProduct.id,
      isLifetime: false,
      expiresAt: new Date(Date.now() + 20 * DAY),
      source: "PURCHASE",
    },
  })
  const renewOrderNo = await makePendingOrder({
    memberId: mRenew.id,
    productId: primaryProduct.id,
    planKey: "YEAR",
    planName: "一年",
    amount: 29,
    days: 365,
    email: "mtest-renew@local.test",
  })
  const renewRes = await applyPaidMembershipOrder(renewOrderNo, "TEST-RENEW")
  check(
    "有限期会员买年卡 → 从当前到期日顺延 ≈385天",
    renewRes.ok && (await access(mRenew.id)) && near(daysLeft((await ent(mRenew.id, primaryProduct.id))!.expiresAt), 385),
    `${daysLeft((await ent(mRenew.id, primaryProduct.id))!.expiresAt)}d`,
  )

  const mUpgrade = await prisma.member.create({ data: { email: "mtest-upgrade@local.test" } })
  await prisma.entitlement.create({
    data: {
      memberId: mUpgrade.id,
      productId: primaryProduct.id,
      isLifetime: false,
      expiresAt: new Date(Date.now() + 20 * DAY),
      source: "PURCHASE",
    },
  })
  const upgradeOrderNo = await makePendingOrder({
    memberId: mUpgrade.id,
    productId: primaryProduct.id,
    planKey: "LIFETIME",
    planName: "永久",
    amount: 69,
    days: null,
    email: "mtest-upgrade@local.test",
  })
  const upgradeRes = await applyPaidMembershipOrder(upgradeOrderNo, "TEST-UPGRADE")
  const upgradedEnt = await ent(mUpgrade.id, primaryProduct.id)
  check("有限期会员买永久 → 升级为永久", upgradeRes.ok && !!upgradedEnt?.isLifetime && upgradedEnt.expiresAt === null)

  const mLifetime = await prisma.member.create({ data: { email: "mtest-lifetime-guard@local.test" } })
  await prisma.entitlement.create({
    data: {
      memberId: mLifetime.id,
      productId: primaryProduct.id,
      isLifetime: true,
      expiresAt: null,
      source: "PURCHASE",
    },
  })
  const staleOrderNo = await makePendingOrder({
    memberId: mLifetime.id,
    productId: primaryProduct.id,
    planKey: "MONTH",
    planName: "一个月",
    amount: 3.9,
    days: 30,
    email: "mtest-lifetime-guard@local.test",
  })
  const staleRes = await applyPaidMembershipOrder(staleOrderNo, "TEST-STALE")
  const guardedEnt = await ent(mLifetime.id, primaryProduct.id)
  const staleOrder = await prisma.membershipOrder.findUniqueOrThrow({ where: { orderNo: staleOrderNo } })
  check(
    "已有永久后历史月卡待支付单回调 → 订单可记账但权益保持永久",
    staleRes.ok && staleOrder.status === "PAID" && !!guardedEnt?.isLifetime && guardedEnt.expiresAt === null,
  )

  console.log("\n— 升级永久补差价 / 前台报价 —")
  const upgradeProduct = await createUpgradeTestProduct()
  const mProrate = await prisma.member.create({ data: { email: "mtest-prorate@local.test" } })
  await makePaidOrder(mProrate.id, upgradeProduct.id, 365, 345, 29)
  await prisma.entitlement.create({
    data: {
      memberId: mProrate.id,
      productId: upgradeProduct.id,
      isLifetime: false,
      expiresAt: new Date(Date.now() + 20 * DAY),
      source: "PURCHASE",
    },
  })
  const quote = await getLifetimeUpgradeQuote(mProrate.id, upgradeProduct.id)
  check(
    "年卡剩约20天 → 永久升级抵扣 floor(29*20/365)=¥1",
    quote.eligible && quote.creditYuan === 1 && quote.rawCreditYuan > 1.5 && quote.rawCreditYuan < 1.7,
    `credit=${quote.creditYuan}, raw=${quote.rawCreditYuan}`,
  )

  const now = new Date()
  const pureMixedCredit = calculateLifetimeUpgradeCredit(
    [
      { source: "COMP", amount: 0, grantsDays: 365, paidAt: new Date(now.getTime() - 30 * DAY) },
      { source: "PURCHASE", amount: 3.9, grantsDays: 30, paidAt: new Date(now.getTime() - 29 * DAY) },
    ],
    now,
  )
  check(
    "赠送期内购买月卡 → 付费月卡排队未使用，升级抵扣仍按¥3.9计算",
    pureMixedCredit.creditYuan === 3 && pureMixedCredit.eligibleOrderCount === 1 && pureMixedCredit.unusedDays === 30,
    `credit=${pureMixedCredit.creditYuan}, unused=${pureMixedCredit.unusedDays}`,
  )

  const mMixed = await prisma.member.create({ data: { email: "mtest-mixed-upgrade@local.test" } })
  const compPaidAt = new Date(Date.now() - 30 * DAY)
  const purchasePaidAt = new Date(Date.now() - 29 * DAY)
  await prisma.membershipOrder.createMany({
    data: [
      {
        orderNo: generateMembershipOrderNo(),
        memberId: mMixed.id,
        productId: upgradeProduct.id,
        planKey: null,
        planName: "赠送 · 365 天",
        source: "COMP",
        amount: 0,
        status: "PAID",
        grantsDays: 365,
        isLifetime: false,
        buyerEmail: "mtest-mixed-upgrade@local.test",
        paidAt: compPaidAt,
      },
      {
        orderNo: generateMembershipOrderNo(),
        memberId: mMixed.id,
        productId: upgradeProduct.id,
        planKey: "MONTH",
        planName: "一个月",
        source: "PURCHASE",
        amount: 3.9,
        status: "PAID",
        grantsDays: 30,
        isLifetime: false,
        buyerEmail: "mtest-mixed-upgrade@local.test",
        paidAt: purchasePaidAt,
      },
    ],
  })
  await prisma.entitlement.create({
    data: {
      memberId: mMixed.id,
      productId: upgradeProduct.id,
      isLifetime: false,
      expiresAt: new Date(Date.now() + 365 * DAY),
      source: "PURCHASE",
    },
  })
  const mixedQuote = await getLifetimeUpgradeQuote(mMixed.id, upgradeProduct.id)
  check(
    "报价接口包含赠送时间轴 → 只抵扣排队中的付费月卡¥3",
    mixedQuote.eligible && mixedQuote.creditYuan === 3 && mixedQuote.eligibleOrderCount === 1,
    `credit=${mixedQuote.creditYuan}, raw=${mixedQuote.rawCreditYuan}`,
  )

  const mRefundedQuote = await prisma.member.create({ data: { email: "mtest-refunded-quote@local.test" } })
  await prisma.membershipOrder.create({
    data: {
      orderNo: generateMembershipOrderNo(),
      memberId: mRefundedQuote.id,
      productId: upgradeProduct.id,
      planKey: "YEAR",
      planName: "一年",
      source: "PURCHASE",
      amount: 29,
      status: "REFUNDED",
      grantsDays: 365,
      isLifetime: false,
      buyerEmail: "mtest-refunded-quote@local.test",
      paidAt: new Date(Date.now() - 10 * DAY),
      refundedAt: new Date(),
    },
  })
  await prisma.entitlement.create({
    data: {
      memberId: mRefundedQuote.id,
      productId: upgradeProduct.id,
      isLifetime: false,
      expiresAt: new Date(Date.now() + 355 * DAY),
      source: "PURCHASE",
    },
  })
  const refundedQuote = await getLifetimeUpgradeQuote(mRefundedQuote.id, upgradeProduct.id)
  check(
    "升级永久报价 → 已退款订单不参与抵扣",
    refundedQuote.eligible && refundedQuote.creditYuan === 0 && refundedQuote.eligibleOrderCount === 0,
    `credit=${refundedQuote.creditYuan}, count=${refundedQuote.eligibleOrderCount}`,
  )

  const prorateCookie = await memberCookie(mProrate.id)
  const plansApi = await getPlans(prorateCookie, "mtest-upgrade").catch(() => null)
  const plansPayload = plansApi ? await plansApi.json().catch(() => ({})) : {}
  const lifetimePlan = Array.isArray(plansPayload.plans)
    ? plansPayload.plans.find((p: { key?: string }) => p.key === "LIFETIME")
    : null
  check(
    "套餐接口 → 永久卡返回 upgradeCredit=1",
    !!plansApi && plansApi.ok && lifetimePlan?.upgradeCredit === 1,
    plansApi ? `${plansApi.status} ${JSON.stringify(lifetimePlan)}` : "fetch failed",
  )
  const prorateApi = await postCreateOrder(prorateCookie, { product: "mtest-upgrade", planKey: "LIFETIME" }).catch(() => null)
  const proratePayload = prorateApi ? await prorateApi.json().catch(() => ({})) : {}
  const prorateOrder = proratePayload.orderNo
    ? await prisma.membershipOrder.findUnique({ where: { orderNo: proratePayload.orderNo } })
    : null
  check(
    "下单接口 → 永久价69-抵扣1，应付68，并写入订单备注",
    !!prorateApi &&
      prorateApi.ok &&
      proratePayload.amount === 68 &&
      proratePayload.upgradeCredit === 1 &&
      prorateOrder?.note === "升级抵扣 ¥1",
    prorateApi ? `${prorateApi.status} amount=${proratePayload.amount} note=${prorateOrder?.note || ""}` : "fetch failed",
  )

  console.log("\n— 真实下单接口鉴权 / 永久限制 —")
  const unauth = await postCreateOrder(null, { product: PRIMARY_TEST_PRODUCT_KEY, planKey: "MONTH" }).catch(() => null)
  check("未登录创建订单 → 401", !!unauth && unauth.status === 401, unauth ? String(unauth.status) : "fetch failed")

  const finiteCookie = await memberCookie(mRenew.id)
  const finiteApi = await postCreateOrder(finiteCookie, { product: PRIMARY_TEST_PRODUCT_KEY, planKey: "MONTH" }).catch(() => null)
  const finitePayload = finiteApi ? await finiteApi.json().catch(() => ({})) : {}
  check("有限期会员创建续期订单 → 200 + PENDING", !!finiteApi && finiteApi.ok && typeof finitePayload.orderNo === "string", finiteApi ? String(finiteApi.status) : "fetch failed")

  const lifetimeCookie = await memberCookie(mLifetime.id)
  const lifetimeApi = await postCreateOrder(lifetimeCookie, { product: PRIMARY_TEST_PRODUCT_KEY, planKey: "MONTH" }).catch(() => null)
  const lifetimePayload = lifetimeApi ? await lifetimeApi.json().catch(() => ({})) : {}
  check(
    "永久会员创建月卡订单 → 400 拒绝重复购买",
    !!lifetimeApi && lifetimeApi.status === 400 && String(lifetimePayload.error || "").includes("通行权益"),
    lifetimeApi ? `${lifetimeApi.status} ${lifetimePayload.error || ""}` : "fetch failed",
  )

  const mReuse = await prisma.member.create({ data: { email: "mtest-order-reuse@local.test" } })
  const reuseCookie = await memberCookie(mReuse.id)
  const reuseFirst = await postCreateOrder(reuseCookie, { product: PRIMARY_TEST_PRODUCT_KEY, planKey: "MONTH" }).catch(() => null)
  const reuseFirstPayload = reuseFirst ? await reuseFirst.json().catch(() => ({})) : {}
  const reuseSecond = await postCreateOrder(reuseCookie, { product: PRIMARY_TEST_PRODUCT_KEY, planKey: "MONTH" }).catch(() => null)
  const reuseSecondPayload = reuseSecond ? await reuseSecond.json().catch(() => ({})) : {}
  check(
    "重复点击同套餐下单 → 15分钟内复用同一待支付单",
    !!reuseFirst &&
      !!reuseSecond &&
      reuseFirst.ok &&
      reuseSecond.ok &&
      reuseFirstPayload.orderNo === reuseSecondPayload.orderNo &&
      reuseSecondPayload.reused === true,
    reuseSecond ? `${reuseSecond.status} ${reuseFirstPayload.orderNo || ""} -> ${reuseSecondPayload.orderNo || ""}` : "fetch failed",
  )

  const monthPlan = await prisma.membershipPlan.findUniqueOrThrow({
    where: { productId_key: { productId: primaryProduct.id, key: "MONTH" } },
    select: { id: true },
  })
  const mPendingFlood = await prisma.member.create({ data: { email: "mtest-pending-flood@local.test" } })
  await prisma.membershipOrder.createMany({
    data: Array.from({ length: 8 }, (_, i) => ({
      orderNo: generateMembershipOrderNo(),
      memberId: mPendingFlood.id,
      productId: primaryProduct.id,
      planId: i === 0 ? monthPlan.id : null,
      planKey: "YEAR" as const,
      planName: `待支付占位 ${i + 1}`,
      source: "PURCHASE" as const,
      amount: 100 + i,
      status: "PENDING" as const,
      grantsDays: 365,
      isLifetime: false,
      buyerEmail: "mtest-pending-flood@local.test",
    })),
  })
  const floodCookie = await memberCookie(mPendingFlood.id)
  const floodApi = await postCreateOrder(floodCookie, { product: PRIMARY_TEST_PRODUCT_KEY, planKey: "MONTH" }).catch(() => null)
  const floodPayload = floodApi ? await floodApi.json().catch(() => ({})) : {}
  check(
    "短时间待支付单过多 → 拒绝继续创建",
    !!floodApi && floodApi.status === 429 && String(floodPayload.error || "").includes("待支付订单"),
    floodApi ? `${floodApi.status} ${floodPayload.error || ""}` : "fetch failed",
  )

  console.log("\n— 兑换码使用资格 —")
  const promo = await prisma.promoCode.create({
    data: {
      code: "MTESTONCE",
      productId: upgradeProduct.id,
      percentOff: 20,
      enabled: true,
    },
  })
  const mPendingPromo = await prisma.member.create({ data: { email: "mtest-promo-pending@local.test" } })
  await prisma.membershipOrder.create({
    data: {
      orderNo: generateMembershipOrderNo(),
      memberId: mPendingPromo.id,
      productId: upgradeProduct.id,
      planKey: "MONTH",
      planName: "一个月",
      source: "PURCHASE",
      amount: 3,
      status: "PENDING",
      grantsDays: 30,
      isLifetime: false,
      buyerEmail: "mtest-promo-pending@local.test",
      promoCodeId: promo.id,
      promoCodeText: promo.code,
    },
  })
  const pendingPromoCheck = await checkPromoCode({
    rawCode: "MTESTONCE",
    productId: upgradeProduct.id,
    memberId: mPendingPromo.id,
  })
  check("兑换码待支付订单 → 不算已使用，仍可校验", pendingPromoCheck.ok)

  const mPromoUsed = await prisma.member.create({ data: { email: "mtest-promo-used@local.test" } })
  await prisma.membershipOrder.create({
    data: {
      orderNo: generateMembershipOrderNo(),
      memberId: mPromoUsed.id,
      productId: upgradeProduct.id,
      planKey: "MONTH",
      planName: "一个月",
      source: "PURCHASE",
      amount: 3,
      status: "PAID",
      grantsDays: 30,
      isLifetime: false,
      buyerEmail: "mtest-promo-used@local.test",
      promoCodeId: promo.id,
      promoCodeText: promo.code,
      paidAt: new Date(),
    },
  })
  const paidPromoCheck = await checkPromoCode({
    rawCode: "MTESTONCE",
    productId: upgradeProduct.id,
    memberId: mPromoUsed.id,
  })
  check(
    "兑换码已支付订单 → 后端拒绝再次使用任意兑换码",
    !paidPromoCheck.ok && paidPromoCheck.error.includes("已使用过兑换码"),
    paidPromoCheck.ok ? "unexpected ok" : paidPromoCheck.error,
  )
  const promoUsedCookie = await memberCookie(mPromoUsed.id)
  const promoMeApi = await getMemberMe(promoUsedCookie, "mtest-upgrade").catch(() => null)
  const promoMePayload = promoMeApi ? await promoMeApi.json().catch(() => ({})) : {}
  check(
    "会员信息接口 → hasPromoUsage=true，前台可隐藏兑换码入口",
    !!promoMeApi && promoMeApi.ok && promoMePayload.hasPromoUsage === true,
    promoMeApi ? `${promoMeApi.status} ${JSON.stringify({ hasPromoUsage: promoMePayload.hasPromoUsage })}` : "fetch failed",
  )

  const limitedPromo = await prisma.promoCode.create({
    data: {
      code: "MTESTLIMIT1",
      productId: upgradeProduct.id,
      percentOff: 20,
      maxRedemptions: 1,
      enabled: true,
    },
  })
  const mPromoLimit = await prisma.member.create({ data: { email: "mtest-promo-limit@local.test" } })
  const promoLimitOrderNo = generateMembershipOrderNo()
  await prisma.membershipOrder.create({
    data: {
      orderNo: promoLimitOrderNo,
      memberId: mPromoLimit.id,
      productId: upgradeProduct.id,
      planKey: "MONTH",
      planName: "一个月",
      source: "PURCHASE",
      amount: 3,
      status: "PENDING",
      grantsDays: 30,
      isLifetime: false,
      buyerEmail: "mtest-promo-limit@local.test",
      promoCodeId: limitedPromo.id,
      promoCodeText: limitedPromo.code,
    },
  })
  const promoApply1 = await applyPaidMembershipOrder(promoLimitOrderNo, "TEST-PROMO-LIMIT")
  const promoApply2 = await applyPaidMembershipOrder(promoLimitOrderNo, "TEST-PROMO-LIMIT")
  const limitedAfter = await prisma.promoCode.findUniqueOrThrow({ where: { id: limitedPromo.id } })
  check(
    "兑换码支付回调重放 → redeemedCount 只增加一次",
    promoApply1.ok && promoApply1.newlyPaid === true && promoApply2.ok && promoApply2.newlyPaid === false && limitedAfter.redeemedCount === 1,
    `redeemed=${limitedAfter.redeemedCount}`,
  )
  const mPromoLimitOther = await prisma.member.create({ data: { email: "mtest-promo-limit-other@local.test" } })
  const limitCheck = await checkPromoCode({
    rawCode: "MTESTLIMIT1",
    productId: upgradeProduct.id,
    memberId: mPromoLimitOther.id,
  })
  check(
    "兑换码达到总量上限 → 新会员也不能再用",
    !limitCheck.ok && limitCheck.error.includes("领完"),
    limitCheck.ok ? "unexpected ok" : limitCheck.error,
  )

  console.log("\n— 退款重算（bug② 修复验证）—")
  // 连续叠加：A30 + B365（都有效）→ ≈395；退 B → 应回 ≈30
  const m3 = await prisma.member.create({ data: { email: "mtest-refund@local.test" } })
  await makePaidOrder(m3.id, primaryProduct.id, 30, 0)
  await prisma.entitlement.create({ data: { memberId: m3.id, productId: primaryProduct.id, isLifetime: false, expiresAt: new Date(Date.now() + 30 * DAY), source: "PURCHASE" } })
  const oB = await makePaidOrder(m3.id, primaryProduct.id, 365, 0)
  await prisma.entitlement.update({ where: { memberId_productId: { memberId: m3.id, productId: primaryProduct.id } }, data: { expiresAt: new Date(Date.now() + 395 * DAY) } })
  const ordB = await prisma.membershipOrder.findUniqueOrThrow({ where: { orderNo: oB } })
  await prisma.membershipOrder.update({ where: { id: ordB.id }, data: { status: "REFUNDED", refundedAt: new Date() } })
  await revertEntitlementForRefund({ id: ordB.id, memberId: m3.id, productId: primaryProduct.id })
  check("退 B(后买的) → 重算回 ≈30天 + 仍可访问", near(daysLeft((await ent(m3.id, primaryProduct.id))!.expiresAt), 30) && (await access(m3.id)), `${daysLeft((await ent(m3.id, primaryProduct.id))!.expiresAt)}d`)

  // gap 场景（旧 bug 会算错）：A 早就过期(400天前买的30天) + B 10天前买的365 → 权益现状 ≈355(只B生效)；退【已过期的A】→ 应仍 ≈355，旧 bug 会减成 ≈325
  const m4 = await prisma.member.create({ data: { email: "mtest-gap@local.test" } })
  const gA = await makePaidOrder(m4.id, primaryProduct.id, 30, 400) // 400天前买的30天（早过期）
  await makePaidOrder(m4.id, primaryProduct.id, 365, 10) // 10天前买的365天
  await prisma.entitlement.create({ data: { memberId: m4.id, productId: primaryProduct.id, isLifetime: false, expiresAt: new Date(Date.now() + 355 * DAY), source: "PURCHASE" } })
  const ordGA = await prisma.membershipOrder.findUniqueOrThrow({ where: { orderNo: gA } })
  await prisma.membershipOrder.update({ where: { id: ordGA.id }, data: { status: "REFUNDED", refundedAt: new Date() } })
  await revertEntitlementForRefund({ id: ordGA.id, memberId: m4.id, productId: primaryProduct.id })
  const gapDays = daysLeft((await ent(m4.id, primaryProduct.id))!.expiresAt)
  check("退【已过期的A】→ 仍 ≈355天（旧bug会错减到≈325）", near(gapDays, 355), `${gapDays}d（旧bug=325）`)

  const mFiniteThenLifetime = await prisma.member.create({ data: { email: "mtest-refund-finite-then-life@local.test" } })
  const finiteBeforeLife = await makePendingOrder({
    memberId: mFiniteThenLifetime.id,
    productId: primaryProduct.id,
    planKey: "MONTH",
    planName: "一个月",
    amount: 3.9,
    days: 30,
    email: "mtest-refund-finite-then-life@local.test",
  })
  await applyPaidMembershipOrder(finiteBeforeLife, "TEST-FINITE-BEFORE-LIFE")
  const lifeAfterFinite = await makePendingOrder({
    memberId: mFiniteThenLifetime.id,
    productId: primaryProduct.id,
    planKey: "LIFETIME",
    planName: "永久",
    amount: 69,
    days: null,
    email: "mtest-refund-finite-then-life@local.test",
  })
  await applyPaidMembershipOrder(lifeAfterFinite, "TEST-LIFE-AFTER-FINITE")
  const finiteOrderBeforeLife = await prisma.membershipOrder.findUniqueOrThrow({ where: { orderNo: finiteBeforeLife } })
  await prisma.membershipOrder.update({ where: { id: finiteOrderBeforeLife.id }, data: { status: "REFUNDED", refundedAt: new Date() } })
  await revertEntitlementForRefund({ id: finiteOrderBeforeLife.id, memberId: mFiniteThenLifetime.id, productId: primaryProduct.id })
  const entAfterFiniteRefund = await ent(mFiniteThenLifetime.id, primaryProduct.id)
  check(
    "退款永久前的月卡 → 后续永久仍保持永久",
    !!entAfterFiniteRefund?.isLifetime && entAfterFiniteRefund.expiresAt === null && (await access(mFiniteThenLifetime.id)),
  )

  const mLifetimeRefund = await prisma.member.create({ data: { email: "mtest-refund-lifetime@local.test" } })
  const finiteForLifeRefund = await makePendingOrder({
    memberId: mLifetimeRefund.id,
    productId: primaryProduct.id,
    planKey: "MONTH",
    planName: "一个月",
    amount: 3.9,
    days: 30,
    email: "mtest-refund-lifetime@local.test",
  })
  await applyPaidMembershipOrder(finiteForLifeRefund, "TEST-FINITE-FOR-LIFE-REFUND")
  const lifetimeForRefund = await makePendingOrder({
    memberId: mLifetimeRefund.id,
    productId: primaryProduct.id,
    planKey: "LIFETIME",
    planName: "永久",
    amount: 69,
    days: null,
    email: "mtest-refund-lifetime@local.test",
  })
  await applyPaidMembershipOrder(lifetimeForRefund, "TEST-LIFETIME-REFUND")
  const lifetimeRefundOrder = await prisma.membershipOrder.findUniqueOrThrow({ where: { orderNo: lifetimeForRefund } })
  await prisma.membershipOrder.update({ where: { id: lifetimeRefundOrder.id }, data: { status: "REFUNDED", refundedAt: new Date() } })
  await revertEntitlementForRefund({ id: lifetimeRefundOrder.id, memberId: mLifetimeRefund.id, productId: primaryProduct.id })
  const entAfterLifetimeRefund = await ent(mLifetimeRefund.id, primaryProduct.id)
  check(
    "退款永久单 → 回到仍有效的有限期权益",
    !entAfterLifetimeRefund?.isLifetime && near(daysLeft(entAfterLifetimeRefund?.expiresAt ?? null), 30) && (await access(mLifetimeRefund.id)),
    `${daysLeft(entAfterLifetimeRefund?.expiresAt ?? null)}d`,
  )

  // 退完所有有效单 → 撤销
  const m5 = await prisma.member.create({ data: { email: "mtest-refundall@local.test" } })
  const sA = await makePaidOrder(m5.id, primaryProduct.id, 365, 0)
  await prisma.entitlement.create({ data: { memberId: m5.id, productId: primaryProduct.id, isLifetime: false, expiresAt: new Date(Date.now() + 365 * DAY), source: "PURCHASE" } })
  const ordSA = await prisma.membershipOrder.findUniqueOrThrow({ where: { orderNo: sA } })
  await prisma.membershipOrder.update({ where: { id: ordSA.id }, data: { status: "REFUNDED", refundedAt: new Date() } })
  await revertEntitlementForRefund({ id: ordSA.id, memberId: m5.id, productId: primaryProduct.id })
  check("退完唯一订单 → 权益撤销 + 不可访问", !(await access(m5.id)))

  console.log("\n— 多产品权益隔离 —")
  const isolatedA = await prisma.product.create({ data: { key: "mtest-isolated-a", name: "隔离产品 A", enabled: true } })
  const isolatedB = await prisma.product.create({ data: { key: "mtest-isolated-b", name: "隔离产品 B", enabled: true } })
  const isolatedGrant = await grantMembership({ productId: isolatedA.id, email: "mtest-isolated@local.test", days: 30 })
  check(
    "买/赠产品A → 不能访问产品B",
    (await access(isolatedGrant.member.id, "mtest-isolated-a")) && !(await access(isolatedGrant.member.id, "mtest-isolated-b")),
  )
  const isolatedBOrder = await makePendingOrder({
    memberId: isolatedGrant.member.id,
    productId: isolatedB.id,
    planKey: "MONTH",
    planName: "一个月",
    amount: 3.9,
    days: 30,
    email: "mtest-isolated@local.test",
  })
  await applyPaidMembershipOrder(isolatedBOrder, "TEST-ISOLATED-B")
  const entAAfterB = await ent(isolatedGrant.member.id, isolatedA.id)
  const entBAfterB = await ent(isolatedGrant.member.id, isolatedB.id)
  check(
    "支付产品B → 只新增产品B权益，不覆盖产品A",
    near(daysLeft(entAAfterB?.expiresAt ?? null), 30) && near(daysLeft(entBAfterB?.expiresAt ?? null), 30),
    `A=${daysLeft(entAAfterB?.expiresAt ?? null)}d B=${daysLeft(entBAfterB?.expiresAt ?? null)}d`,
  )

  console.log("\n— 全站通 isAllAccess —")
  const pOther = await prisma.product.create({ data: { key: "mtest-other", name: "其他产品", enabled: true } })
  await prisma.product.create({ data: { key: "mtest-all", name: "全站通", enabled: true, isAllAccess: true } })
  const allId = (await prisma.product.findUniqueOrThrow({ where: { key: "mtest-all" } })).id
  const g6 = await grantMembership({ productId: allId, email: "mtest-allaccess@local.test", days: 365 })
  check("买全站通产品 → 可访问其他产品", await access(g6.member.id, "mtest-other"), `(other id ${pOther.id.slice(0, 6)})`)

  await cleanup()
  console.log(`\n=== 共 ${pass + fail} 项：✅ ${pass} 通过 · ❌ ${fail} 失败 ===`)
  await prisma.$disconnect()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error("测试脚本异常:", e)
  try {
    await cleanup()
    await prisma.$disconnect()
  } catch {}
  process.exit(1)
})
