import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getClientIp } from "@/lib/guestbook"
import { sendOrderEmail } from "@/lib/email"
import { normalizeSiteName } from "@/lib/page-copy"

export const dynamic = "force-dynamic"

/** 限流：同一 IP 每分钟最多 5 次（防枚举他人邮箱 + 防借此接口发信滥用）。 */
const checkRateState = globalThis as typeof globalThis & {
  __orderCheckRate?: Map<string, { count: number; windowStart: number }>
}
function checkRateOk(ip: string): boolean {
  const now = Date.now()
  const WINDOW = 60_000
  const MAX = 5
  if (!checkRateState.__orderCheckRate) checkRateState.__orderCheckRate = new Map()
  const m = checkRateState.__orderCheckRate
  const s = m.get(ip)
  if (!s || now - s.windowStart >= WINDOW) {
    m.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (s.count >= MAX) return false
  s.count += 1
  return true
}

/**
 * GET: 查询邮箱对某作品的购买状态（purchased、价格、升级价等）。
 * 安全：命中已购时，交付链接只【发到该邮箱】，绝不在响应里返回——
 * 攻击者即使输入他人邮箱，链接也只会进他人信箱，无法凭邮箱套取付费内容。
 */
export async function GET(request: NextRequest) {
  if (!checkRateOk(getClientIp(request))) {
    return NextResponse.json({ error: "操作太频繁，请稍后再试" }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")?.trim().toLowerCase()
  const workId = searchParams.get("workId")

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "请输入有效的邮箱" }, { status: 400 })
  }
  if (!workId) {
    return NextResponse.json({ error: "缺少 workId" }, { status: 400 })
  }

  const work = await prisma.work.findUnique({
    where: { id: workId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })
  if (!work || work.status !== "PUBLISHED") {
    return NextResponse.json({ error: "作品不存在" }, { status: 404 })
  }

  const latestVersion = work.versions[0] ?? null
  const currentPrice = latestVersion ? Number(latestVersion.price) : (work.price ? Number(work.price) : 0)
  const currentVersionLabel = work.currentVersion || latestVersion?.version || null

  const latestOrder = await prisma.order.findFirst({
    where: { workId, buyerEmail: email, status: "PAID" },
    orderBy: { createdAt: "desc" },
    include: { version: true },
  })

  if (!latestOrder) {
    return NextResponse.json({
      purchased: false,
      currentPrice,
      currentVersion: currentVersionLabel,
      isFree: work.isFree,
    })
  }

  const paidVersionId = latestOrder.versionId
  // 没有版本系统（老数据）或已购买最新版本 → 视为持有最新版
  const hasLatest = !latestVersion || paidVersionId === latestVersion.id

  // 升级价：最新价 − 该邮箱已付总额（不返回任何链接）
  const allPaidOrders = await prisma.order.findMany({
    where: { workId, buyerEmail: email, status: "PAID" },
    select: { amount: true },
  })
  const totalPaid = allPaidOrders.reduce((sum, o) => sum + Number(o.amount), 0)
  const upgradePrice = Math.max(0, currentPrice - totalPaid)

  // 选定要发送的交付链接：已购最新版发最新版链接，否则发该邮箱最近购买版本的链接
  const figmaUrl =
    (hasLatest ? latestVersion?.figmaUrl ?? work.figmaUrl : latestOrder.version?.figmaUrl) ??
    work.figmaUrl ??
    null
  const deliveryUrl =
    (hasLatest ? latestVersion?.deliveryUrl ?? work.deliveryUrl : latestOrder.version?.deliveryUrl) ??
    work.deliveryUrl ??
    null

  // 关键：交付链接只发邮箱，不进响应
  const settings = await prisma.settings.findUnique({ where: { id: "settings" } })
  const socialLinks = (settings?.socialLinks as Record<string, string> | null) || {}
  sendOrderEmail({
    to: email,
    siteName: normalizeSiteName(settings?.siteName),
    workTitle: work.title,
    orderNo: latestOrder.orderNo,
    isFree: false,
    amount: Number(latestOrder.amount),
    figmaUrl,
    deliveryUrl,
    currentVersion: latestOrder.version?.version ?? currentVersionLabel,
    wechat: socialLinks.wechat ?? null,
  }).catch(() => {})

  return NextResponse.json({
    purchased: true,
    hasLatest,
    delivered: true,
    paidVersion: latestOrder.version?.version ?? null,
    paidAmount: totalPaid,
    upgradePrice,
    currentPrice,
    currentVersion: currentVersionLabel,
    latestVersionId: latestVersion?.id,
    isFree: work.isFree,
  })
}
