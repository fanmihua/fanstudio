/**
 * 站点统计（宣传用）：独立访客数 + 累计通行人数。
 * 访问 = baseVisits(后台基数) + 真实独立访客数（按设备 cookie 去重；列名沿用 pageViews）
 * 通行 = basePasses(后台基数) + 累计开通人数(有过任意权益的会员，含已过期/赠送)
 * 单行表 id="site"，首次访问自动建行。用独立访客而非 PV：同一人刷新/返回不再变，更可信。
 */
import prisma from "@/lib/prisma"

const ROW_ID = "site"

/** 记一个新独立访客：计数原子 +1（首次自动建行）。仅由路由判定 cookie 不存在时调用。 */
export async function recordUniqueVisit(): Promise<void> {
  await prisma.siteStat.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, pageViews: 1 },
    update: { pageViews: { increment: 1 } },
  })
}

/** 读展示数（基数 + 真实增量）。只读，不自增。 */
export async function getSiteStats(): Promise<{ visits: number; passes: number }> {
  const [row, memberCount] = await Promise.all([
    prisma.siteStat.findUnique({ where: { id: ROW_ID } }),
    // 累计开通人数：有过 ≥1 条权益的会员（含已过期/已撤销/赠送）
    prisma.member.count({ where: { entitlements: { some: {} } } }),
  ])
  return {
    visits: (row?.baseVisits ?? 0) + (row?.pageViews ?? 0),
    passes: (row?.basePasses ?? 0) + memberCount,
  }
}

/** 后台读基数配置 + 真实分量（用于后台展示与编辑）。 */
export async function getStatConfig(): Promise<{
  baseVisits: number
  basePasses: number
  pageViews: number
  realPasses: number
}> {
  const [row, realPasses] = await Promise.all([
    prisma.siteStat.upsert({ where: { id: ROW_ID }, create: { id: ROW_ID }, update: {} }),
    prisma.member.count({ where: { entitlements: { some: {} } } }),
  ])
  return { baseVisits: row.baseVisits, basePasses: row.basePasses, pageViews: row.pageViews, realPasses }
}

/** 后台设基数。 */
export async function setStatBase(baseVisits: number, basePasses: number): Promise<void> {
  await prisma.siteStat.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, baseVisits, basePasses },
    update: { baseVisits, basePasses },
  })
}
