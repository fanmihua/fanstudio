"use client"
/** 后台首页内容：统计卡片、快捷入口、最近订单、收入图表。 */
import Link from "next/link"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

export interface DashboardStats {
  totalPosts: number
  totalDesignWorks: number
  totalDevWorks: number
  totalTutorials: number
  totalOrders: number
  monthlyRevenue: number
  monthPosts: number
  monthDesignWorks: number
  monthDevWorks: number
  monthTutorials: number
  monthOrders: number
  prevMonthRevenue: number
}

export interface RecentOrder {
  id: string
  orderNo: string
  status: string
  amount: number | string
  createdAt: string
  workTitle: string
}

export interface DailyRevenue {
  date: string     // "MM/DD"
  paid: number
  pending: number
}

export interface InterestStats {
  visits: number
  likes: number
  guestbook: number
  members: {
    total: number
    active: number
    paid: number
    comp: number
    none: number
    byProduct: { name: string; paid: number; comp: number }[]
  }
}

interface DashboardContentProps {
  stats: DashboardStats
  recentOrders: RecentOrder[]
  dailyRevenue: DailyRevenue[]
  interest: InterestStats
  /** 为 true 时在「最近订单」区块显示无权限提示（如体验账户） */
  orderBlockForbidden?: boolean
}

const revenueChartConfig = {
  paid:    { label: "已支付", color: "var(--color-foreground)" },
  pending: { label: "未支付", color: "var(--color-foreground)" },
}

function formatCurrency(n: number, locale: "zh" | "en") {
  return `¥${n.toLocaleString(locale === "en" ? "en-US" : "zh-CN")}`
}

function calcTrend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  href,
}: {
  title: string
  value: string
  subtitle: string
  icon: string
  trend?: number
  href?: string
}) {
  const content = (
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <div className="flex items-center gap-1.5 text-xs">
          {trend !== undefined && trend !== 0 && (
            <span
              className={
                trend > 0
                  ? "inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400"
                  : "inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400"
              }
            >
              <i className={trend > 0 ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
              {Math.abs(trend)}%
            </span>
          )}
          <span className="text-muted-foreground">{subtitle}</span>
        </div>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/60">
        <i className={`${icon} text-lg text-muted-foreground`} />
      </div>
    </div>
  )

  const cls = "group rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-5 transition-all duration-200 hover:bg-accent/30"

  if (href) {
    return <Link href={href} className={`${cls} block`}>{content}</Link>
  }
  return <div className={cls}>{content}</div>
}

function RevenueTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color?: string; strokeDasharray?: string }>
  label?: string
}) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  if (!active || !payload?.length) return null
  const nameMap: Record<string, string> = { paid: t("已支付", "Paid"), pending: t("未支付", "Pending") }
  return (
    <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-sm px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">
            {nameMap[p.name] || p.name}:
          </span>
          <span className="font-medium text-foreground">
            {formatCurrency(p.value, locale)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardContent({
  stats,
  recentOrders,
  dailyRevenue,
  interest,
  orderBlockForbidden = false,
}: DashboardContentProps) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const quickActions = [
    { title: t("写文章", "Write Post"), desc: t("发布新的笔记或文章", "Publish a new post"), href: "/admin/posts/new", icon: "ri-article-line" },
    { title: t("设计作品", "Design Work"), desc: t("添加新的设计作品", "Add a new design work"), href: "/admin/works/new?type=design", icon: "ri-palette-line" },
    { title: t("开发作品", "Development Work"), desc: t("添加新的开发作品", "Add a new development work"), href: "/admin/works/new?type=development", icon: "ri-code-s-slash-line" },
    { title: t("视频教程", "Tutorial"), desc: t("添加新的视频教程", "Add a new tutorial"), href: "/admin/tutorials/new", icon: "ri-video-line" },
  ]
  const statusLabels: Record<string, { text: string; className: string; dotColor: string }> = {
    PAID: { text: t("已支付", "Paid"), className: "text-emerald-600 dark:text-emerald-400", dotColor: "bg-emerald-500" },
    PENDING: { text: t("待支付", "Pending"), className: "text-amber-600 dark:text-amber-400", dotColor: "bg-amber-500" },
    CANCELLED: { text: t("已取消", "Cancelled"), className: "text-zinc-400 dark:text-zinc-500", dotColor: "bg-zinc-400" },
    REFUNDED: { text: t("已退款", "Refunded"), className: "text-rose-600 dark:text-rose-400", dotColor: "bg-rose-500" },
  }
  const revenueTrend = calcTrend(stats.monthlyRevenue, stats.prevMonthRevenue)

  const today = new Date()
  const dateStr = today.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

  return (
    <div className="space-y-8">
      {/* ---- header ---- */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("仪表盘", "Dashboard")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("欢迎回来，这是你的网站概览", "Welcome back. Here's your site overview")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{dateStr}</p>
      </div>

      {/* ---- stats cards ---- */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title={t("文章", "Posts")}
          value={String(stats.totalPosts)}
          subtitle={t(`+${stats.monthPosts} 本月`, `+${stats.monthPosts} this month`)}
          icon="ri-article-line"
          href="/admin/posts"
        />
        <StatCard
          title={t("设计作品", "Design Works")}
          value={String(stats.totalDesignWorks)}
          subtitle={t(`+${stats.monthDesignWorks} 本月`, `+${stats.monthDesignWorks} this month`)}
          icon="ri-palette-line"
          href="/admin/works/design"
        />
        <StatCard
          title={t("开发作品", "Dev Works")}
          value={String(stats.totalDevWorks)}
          subtitle={t(`+${stats.monthDevWorks} 本月`, `+${stats.monthDevWorks} this month`)}
          icon="ri-code-s-slash-line"
          href="/admin/works/development"
        />
        <StatCard
          title={t("视频教程", "Tutorials")}
          value={String(stats.totalTutorials)}
          subtitle={t(`+${stats.monthTutorials} 本月`, `+${stats.monthTutorials} this month`)}
          icon="ri-video-line"
          href="/admin/tutorials"
        />
        <StatCard
          title={t("订单", "Orders")}
          value={String(stats.totalOrders)}
          subtitle={t(`+${stats.monthOrders} 本月`, `+${stats.monthOrders} this month`)}
          icon="ri-shopping-cart-line"
          href="/admin/orders"
        />
        <StatCard
          title={t("本月收入", "Revenue")}
          value={formatCurrency(stats.monthlyRevenue, locale)}
          subtitle={t("较上月", "vs last month")}
          icon="ri-money-cny-circle-line"
          trend={revenueTrend}
        />
      </div>

      {/* ---- 网站兴趣概览（访问 / 会员转化 / 互动，跨产品）---- */}
      <div className="space-y-4">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">{t("网站兴趣概览", "Interest Overview")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("大家对网站的兴趣：访问 · 会员转化 · 互动（跨产品）", "Visits · member conversion · engagement (across products)")}</p>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard title={t("访问", "Visits")} value={interest.visits.toLocaleString()} subtitle={t("独立访客", "unique visitors")} icon="ri-eye-line" />
          <StatCard title={t("注册会员", "Members")} value={interest.members.total.toLocaleString()} subtitle={t(`${interest.members.active} 已开通`, `${interest.members.active} active`)} icon="ri-user-line" href="/admin/membership/members" />
          <StatCard title={t("付费会员", "Paid")} value={interest.members.paid.toLocaleString()} subtitle={t(`赠送 ${interest.members.comp}`, `${interest.members.comp} comp`)} icon="ri-vip-crown-line" href="/admin/membership/members" />
          <StatCard title={t("未开通", "No access")} value={interest.members.none.toLocaleString()} subtitle={t("登录未付费", "logged-in only")} icon="ri-user-unfollow-line" href="/admin/membership/members" />
          <StatCard title={t("点赞", "Likes")} value={interest.likes.toLocaleString()} subtitle={t("内容累计", "content total")} icon="ri-heart-line" />
          <StatCard title={t("留言", "Messages")} value={interest.guestbook.toLocaleString()} subtitle={t("访客留言", "guestbook")} icon="ri-chat-3-line" href="/admin/guestbook" />
        </div>
        {interest.members.byProduct.length > 1 && (
          <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
            <h3 className="text-sm font-medium text-foreground mb-3">{t("各产品会员", "Members by product")}</h3>
            <div className="space-y-2">
              {interest.members.byProduct.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {t("付费", "Paid")} <b className="text-foreground">{p.paid}</b> · {t("赠送", "Comp")} <b className="text-foreground">{p.comp}</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- chart + quick actions row ---- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* revenue chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-semibold text-foreground">{t("收入趋势", "Revenue Trend")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t("近 30 天每日收入", "Daily revenue in last 30 days")}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-foreground" />
                {t("已支付", "Paid")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-foreground border-dashed" />
                {t("未支付", "Pending")}
              </span>
            </div>
          </div>

          <ChartContainer config={revenueChartConfig} className="aspect-auto h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyRevenue} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="fillPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-foreground)" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="var(--color-foreground)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/30" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <Tooltip content={<RevenueTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="paid"
                  name="paid"
                  stroke="var(--color-foreground)"
                  strokeWidth={2}
                  fill="url(#fillPaid)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: "var(--color-background)" }}
                />
                <Area
                  type="monotone"
                  dataKey="pending"
                  name="pending"
                  stroke="var(--color-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  fill="url(#fillPending)"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 2, fill: "var(--color-background)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* quick actions */}
        <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
          <h2 className="font-serif text-lg font-semibold text-foreground">{t("快速操作", "Quick Actions")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">{t("常用功能入口", "Common shortcuts")}</p>

          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-accent/50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/60 transition-colors group-hover:bg-accent">
                    <i className={`${action.icon} text-base text-muted-foreground group-hover:text-foreground transition-colors`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{action.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ---- recent orders ---- */}
      <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between p-5 pb-0">
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">{t("最近订单", "Recent Orders")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("最新 5 笔订单记录", "Latest 5 orders")}</p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            {t("查看全部", "View all")} <i className="ri-arrow-right-s-line" />
          </Link>
        </div>

        {orderBlockForbidden ? (
          <div className="p-5 text-center text-sm text-muted-foreground">{t("无权限查看订单", "No permission to view orders")}</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">{t("暂无订单", "No orders yet")}</div>
        ) : (
          <div className="p-5">
            {/* desktop table header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_100px] gap-4 text-xs font-medium text-muted-foreground pb-3 border-b border-border/30 mb-1">
              <span>{t("作品 / 订单号", "Work / Order No.")}</span>
              <span>{t("时间", "Time")}</span>
              <span className="text-right">{t("金额", "Amount")}</span>
              <span className="text-right">{t("状态", "Status")}</span>
            </div>

            <div className="divide-y divide-border/30">
              {recentOrders.map((order) => {
                const sl = statusLabels[order.status] || {
                  text: order.status,
                  className: "text-muted-foreground",
                  dotColor: "bg-zinc-400",
                }
                const amt = Number(order.amount)
                return (
                  <div
                    key={order.id}
                    className="py-3 first:pt-2 last:pb-0"
                  >
                    {/* mobile layout */}
                    <div className="sm:hidden flex items-center justify-between">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate">{order.workTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.orderNo} · {new Date(order.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", { month: "2-digit", day: "2-digit" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-medium text-sm text-foreground">
                          {amt > 0 ? formatCurrency(amt, locale) : t("开源", "Open Source")}
                        </p>
                        <p className={`text-xs ${sl.className}`}>{sl.text}</p>
                      </div>
                    </div>
                    {/* desktop layout */}
                    <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_100px] gap-4 items-center">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{order.workTitle}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.orderNo}</p>
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {new Date(order.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-sm font-medium text-foreground text-right tabular-nums">
                        {amt > 0 ? formatCurrency(amt, locale) : t("开源", "Open Source")}
                      </p>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${sl.dotColor}`} />
                        <span className={`text-xs ${sl.className}`}>{sl.text}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
