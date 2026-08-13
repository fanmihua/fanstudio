/** 留言板 API：公开列表 + 公开发表（含防滥用）；?admin=1 为后台审核列表。 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/require-admin"
import { sendGuestbookNotifyEmail } from "@/lib/email"
import { checkRate, getClientIp, hashIp, validateMessage } from "@/lib/guestbook"
import { defaultPersonalName } from "@/lib/page-copy"
import { getPublicSiteUrl } from "@/lib/utils"

export const dynamic = "force-dynamic"

const TOP_LIMIT = 50

export async function GET(request: NextRequest) {
  const isAdminView = new URL(request.url).searchParams.get("admin") === "1"

  // 后台审核：返回全部（含隐藏、含回复关系），需管理员
  if (isAdminView) {
    const check = await requireAdmin()
    if (!check.authorized) return check.response
    const all = await prisma.guestbookMessage.findMany({
      orderBy: { createdAt: "desc" },
      include: { parent: { select: { id: true, nickname: true } } },
    })
    return NextResponse.json({ messages: all })
  }

  // 公开：顶层留言最新在上，每条带可见回复（按时间正序）
  const [messages, total] = await Promise.all([
    prisma.guestbookMessage.findMany({
      where: { parentId: null, hidden: false },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: TOP_LIMIT,
      include: {
        replies: {
          where: { hidden: false },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.guestbookMessage.count({ where: { hidden: false } }),
  ])

  return NextResponse.json({ messages, total })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求无效" }, { status: 400 })
  }

  // 蜜罐：隐藏字段被填 = 机器人，静默丢弃（返回成功，不写库，避免被探测）
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 })
  }

  // 限流（按 IP）
  const ip = getClientIp(request)
  const rate = checkRate(ip)
  if (!rate.ok) {
    return NextResponse.json(
      { error: "留言太频繁啦，歇一会儿再来～" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    )
  }

  // 内容校验（长度 / 链接数）
  const v = validateMessage(body.nickname, body.content)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  // 回复目标校验：必须存在；只允许一层盖楼（回复"回复"时归到其父）
  let parentId: string | null = null
  if (typeof body.parentId === "string" && body.parentId) {
    const parent = await prisma.guestbookMessage.findUnique({
      where: { id: body.parentId },
      select: { id: true, parentId: true, hidden: true },
    })
    if (!parent || parent.hidden) {
      return NextResponse.json({ error: "要回复的留言不存在了" }, { status: 400 })
    }
    parentId = parent.parentId ?? parent.id
  }

  // 登录管理员 = 博主标记
  const session = await auth()
  const isOwner = (session?.user as { role?: string })?.role === "ADMIN"
  // 博主公开名取站点人设（profileCard.personalName，如「范米花儿」），而非登录账号名
  let ownerName: string | null = null
  if (isOwner) {
    const s = await prisma.settings.findUnique({ where: { id: "settings" }, select: { about: true } })
    const about = s?.about as {
      profileCard?: { personalName?: string }
      zh?: { profileCard?: { personalName?: string } }
      en?: { profileCard?: { personalName?: string } }
    } | null
    ownerName =
      about?.zh?.profileCard?.personalName ||
      about?.en?.profileCard?.personalName ||
      about?.profileCard?.personalName ||
      defaultPersonalName
  }

  const created = await prisma.guestbookMessage.create({
    data: {
      nickname: isOwner ? v.nickname ?? ownerName : v.nickname,
      content: v.content,
      isOwner,
      ipHash: hashIp(ip),
      parentId,
    },
  })

  // 通知邮件：博主自己发的不通知；异步、失败不影响留言
  if (!isOwner) {
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Fan's Studio"
    const siteUrl = getPublicSiteUrl()
    void sendGuestbookNotifyEmail({
      siteName,
      nickname: created.nickname || "匿名朋友",
      content: created.content,
      isReply: Boolean(parentId),
      url: `${siteUrl}/guestbook`,
    }).catch(() => {})
  }

  return NextResponse.json(created, { status: 201 })
}
