"use client"
/** 后台侧栏：导航分组、主题切换、站点名、收起态；需包在 ThemeProvider 内。 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { useMounted } from "@/hooks/useMounted"
import { defaultNav } from "@/lib/nav-config"
import { defaultSiteName } from "@/lib/page-copy"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { signOut } from "next-auth/react"
import { getDictionary } from "@/locales"
import { t } from "@/lib/i18n"

const ADMIN_LABELS: Record<string, { zh: string; en: string }> = {
  overview: { zh: "概览", en: "Overview" },
  content: { zh: "内容管理", en: "Content" },
  system: { zh: "系统", en: "System" },
  ai: { zh: "AI 模块", en: "AI" },
  dashboard: { zh: "仪表盘", en: "Dashboard" },
  posts: { zh: "文章管理", en: "Posts" },
  designWorks: { zh: "设计作品", en: "Design Works" },
  devWorks: { zh: "开发作品", en: "Development Works" },
  tutorials: { zh: "视频教程", en: "Tutorials" },
  orders: { zh: "订单管理", en: "Orders" },
  categories: { zh: "分类标签", en: "Categories & Tags" },
  settings: { zh: "网站设置", en: "Settings" },
  guestbook: { zh: "来坐坐留言", en: "Guestbook" },
  moments: { zh: "生活动态", en: "Life Moments" },
  aiAssistant: { zh: "AI 助手", en: "AI Assistant" },
  knowledge: { zh: "知识库", en: "Knowledge Base" },
  membership: { zh: "付费产品", en: "Paid Products" },
  plans: { zh: "套餐", en: "Plans" },
  promoCodes: { zh: "兑换码", en: "Promo codes" },
  memberOrders: { zh: "会员订单", en: "Member Orders" },
  memberGrant: { zh: "赠送开通", en: "Grant Access" },
  members: { zh: "会员", en: "Members" },
  memberLogs: { zh: "事件日志", en: "Event Logs" },
  products: { zh: "产品", en: "Products" },
  memberAndOrders: { zh: "会员与订单", en: "Members & Orders" },
  marketingAndGrant: { zh: "兑换码与赠送", en: "Promos & Grants" },
  salesConfig: { zh: "售卖配置", en: "Sales Config" },
}

const GROUP_COLLAPSE_STORAGE_KEY = "admin-sidebar-group-collapsed"
type GroupKey = "overview" | "content" | "system" | "membership" | "ai"
type SidebarItem = {
  name: string
  href: string
  icon: string
  matchHrefs?: string[]
}
type SidebarGroup = {
  key: GroupKey
  label: string
  items: SidebarItem[]
}

function pickLabel(key: keyof typeof ADMIN_LABELS, locale: "zh" | "en"): string {
  return ADMIN_LABELS[key][locale]
}

function matchesSidebarItem(pathname: string, item: SidebarItem) {
  const hrefs = [item.href, ...(item.matchHrefs ?? [])]
  return hrefs.some((href) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`)))
}

/** 收起态右侧 Tooltip 包裹器，展开态直接渲染 children */
function SidebarTooltip({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: React.ReactNode
}) {
  if (!collapsed) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function AdminSidebar({
  siteName,
  collapsed,
  width,
  onToggleCollapse,
  uiLocale,
  onToggleLocale,
}: {
  siteName: string
  collapsed: boolean
  width: number
  onToggleCollapse: () => void
  uiLocale: "zh" | "en"
  onToggleLocale: () => void
}) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const displayName = siteName.trim() || defaultSiteName

  const themeLightLabel = uiLocale === "en" ? "Light Mode" : (defaultNav.themeLightLabel ?? "亮色模式")
  const themeDarkLabel = uiLocale === "en" ? "Dark Mode" : (defaultNav.themeDarkLabel ?? "暗色模式")
  const themeLabel = mounted ? (theme === "dark" ? themeLightLabel : themeDarkLabel) : themeDarkLabel
  const themeIcon = mounted ? (theme === "dark" ? "ri-sun-line" : "ri-moon-line") : "ri-moon-line"
  const themeTooltip = mounted ? themeLabel : themeDarkLabel
  const dict = getDictionary(uiLocale)
  const viewSiteLabel = uiLocale === "en" ? "View Site" : "查看网站"
  const signOutLabel = uiLocale === "en" ? "Sign Out" : "退出登录"
  const collapseLabel = uiLocale === "en" ? "Collapse" : "收起"
  const expandLabel = uiLocale === "en" ? "Expand Navigation" : "展开导航"
  const collapseGroupLabel = uiLocale === "en" ? "Collapse" : "收起"
  const expandGroupLabel = uiLocale === "en" ? "Expand" : "展开"
  const localeLabel = t(dict, "common.language", "Language")
  const localeSwitch = uiLocale === "zh" ? "English" : "中文"
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(GROUP_COLLAPSE_STORAGE_KEY)
        if (raw) setCollapsedGroups(JSON.parse(raw))
      } catch {}
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(GROUP_COLLAPSE_STORAGE_KEY, JSON.stringify(collapsedGroups))
    } catch {}
  }, [collapsedGroups])

  function toggleGroup(key: GroupKey) {
    if (key === "overview") return
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const localizedGroups: SidebarGroup[] = [
    {
      key: "overview" as const,
      label: pickLabel("overview", uiLocale),
      items: [
        { name: pickLabel("dashboard", uiLocale), href: "/admin", icon: "ri-dashboard-line" },
      ],
    },
    {
      key: "content" as const,
      label: pickLabel("content", uiLocale),
      items: [
        { name: pickLabel("posts", uiLocale), href: "/admin/posts", icon: "ri-article-line" },
        { name: pickLabel("designWorks", uiLocale), href: "/admin/works/design", icon: "ri-palette-line" },
        { name: pickLabel("devWorks", uiLocale), href: "/admin/works/development", icon: "ri-code-s-slash-line" },
        { name: pickLabel("tutorials", uiLocale), href: "/admin/tutorials", icon: "ri-video-line" },
        { name: pickLabel("moments", uiLocale), href: "/admin/moments", icon: "ri-camera-line" },
      ],
    },
    {
      key: "system" as const,
      label: pickLabel("system", uiLocale),
      items: [
        { name: pickLabel("orders", uiLocale), href: "/admin/orders", icon: "ri-shopping-cart-line" },
        { name: pickLabel("guestbook", uiLocale), href: "/admin/guestbook", icon: "ri-cup-line" },
        { name: pickLabel("categories", uiLocale), href: "/admin/categories", icon: "ri-price-tag-3-line" },
        { name: pickLabel("settings", uiLocale), href: "/admin/settings", icon: "ri-settings-3-line" },
      ],
    },
    {
      key: "membership" as const,
      label: pickLabel("membership", uiLocale),
      items: [
        {
          name: pickLabel("memberAndOrders", uiLocale),
          href: "/admin/membership/members",
          icon: "ri-user-star-line",
          matchHrefs: ["/admin/membership/orders"],
        },
        {
          name: pickLabel("marketingAndGrant", uiLocale),
          href: "/admin/membership/promo-codes",
          icon: "ri-coupon-3-line",
          matchHrefs: ["/admin/membership/grant"],
        },
        {
          name: pickLabel("salesConfig", uiLocale),
          href: "/admin/membership/plans",
          icon: "ri-vip-crown-line",
          matchHrefs: ["/admin/membership/products"],
        },
        {
          name: pickLabel("memberLogs", uiLocale),
          href: "/admin/membership/events",
          icon: "ri-file-list-3-line",
        },
      ],
    },
    {
      key: "ai" as const,
      label: pickLabel("ai", uiLocale),
      items: [
        { name: pickLabel("aiAssistant", uiLocale), href: "/admin/ai", icon: "ri-robot-2-line" },
        { name: pickLabel("knowledge", uiLocale), href: "/admin/ai-knowledge", icon: "ri-database-2-line" },
      ],
    },
  ]

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className="fixed inset-y-0 left-0 z-50 border-r border-border/50 bg-background/80 backdrop-blur-xl admin-sidebar"
        style={{ width, transition: "width 200ms" }}
      >
        <div className="flex h-full flex-col">
          {/* Logo / Site Name */}
          <div
            className={cn(
              "flex h-16 items-center gap-2 border-b border-border/50 transition-[padding] duration-200",
              collapsed ? "justify-center px-2" : "px-4"
            )}
          >
            {collapsed ? (
              <SidebarTooltip label={expandLabel} collapsed={collapsed}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 shrink-0 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  onClick={onToggleCollapse}
                  aria-label={expandLabel}
                >
                  <i className="ri-menu-unfold-line text-lg" />
                </Button>
              </SidebarTooltip>
            ) : (
              <>
                <Link href="/admin" className="flex min-w-0 flex-1 items-baseline gap-2 group">
                  <span className="font-serif text-xl font-bold tracking-tight text-foreground truncate leading-none">
                    {displayName}
                  </span>
                  <span className="text-sm text-muted-foreground shrink-0 leading-none translate-y-[-1px]">{t(dict, "admin.title", "Admin")}</span>
                </Link>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      onClick={onToggleCollapse}
                      aria-label={collapseLabel}
                    >
                      <i className="ri-menu-fold-line text-lg" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {collapseLabel}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-4">
            {localizedGroups.map((group, groupIndex) => {
              const groupCollapsed = !!collapsedGroups[group.key]
              const canCollapseGroup = group.key !== "overview"

              return (
                <div key={group.key}>
                  {/* Group label / divider */}
                  {groupIndex > 0 && (
                    collapsed ? (
                      <SidebarTooltip label={group.label} collapsed={collapsed}>
                        <button
                          type="button"
                          className={cn(
                            "my-2 mx-auto flex h-7 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                            groupCollapsed && "text-foreground"
                          )}
                          onClick={() => toggleGroup(group.key)}
                          aria-label={`${groupCollapsed ? expandGroupLabel : collapseGroupLabel} ${group.label}`}
                          aria-expanded={!groupCollapsed}
                        >
                          <i className={cn("text-base", groupCollapsed ? "ri-add-line" : "ri-subtract-line")} />
                        </button>
                      </SidebarTooltip>
                    ) : (
                      <button
                        type="button"
                        className="mb-1.5 mt-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-left text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50 transition-colors hover:bg-accent/40 hover:text-muted-foreground"
                        onClick={() => toggleGroup(group.key)}
                        aria-label={`${groupCollapsed ? expandGroupLabel : collapseGroupLabel} ${group.label}`}
                        aria-expanded={!groupCollapsed}
                      >
                        <span>{group.label}</span>
                        <i
                          className={cn(
                            "ri-arrow-down-s-line text-sm transition-transform duration-200",
                            groupCollapsed && "-rotate-90"
                          )}
                        />
                      </button>
                    )
                  )}

                  {/* Nav items */}
                  {(!canCollapseGroup || !groupCollapsed) && (
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = matchesSidebarItem(pathname, item)
                        return (
                          <SidebarTooltip key={item.href} label={item.name} collapsed={collapsed}>
                            <Link
                              href={item.href}
                              className={cn(
                                "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                collapsed ? "justify-center px-0" : "gap-3",
                                isActive
                                  ? "bg-accent text-foreground"
                                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                              )}
                            >
                              <i className={`${item.icon} text-base shrink-0`} />
                              {!collapsed && (
                                <span className="tracking-wide truncate">{item.name}</span>
                              )}
                            </Link>
                          </SidebarTooltip>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Bottom actions */}
          <div
            className={cn(
              "border-t border-border/50 space-y-1 transition-[padding] duration-200",
              collapsed ? "p-2 flex flex-col items-center" : "p-4"
            )}
          >
            <SidebarTooltip label={themeTooltip} collapsed={collapsed}>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                className={cn(
                  "text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200",
                  collapsed
                    ? "size-9 shrink-0"
                    : "w-full justify-start gap-3 px-3 py-2.5 h-auto"
                )}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <i className={cn("text-base shrink-0", themeIcon)} />
                {!collapsed && <span className="tracking-wide">{themeLabel}</span>}
              </Button>
            </SidebarTooltip>

            <SidebarTooltip label={viewSiteLabel} collapsed={collapsed}>
              <Link
                href="/"
                className={cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200",
                  collapsed ? "justify-center px-0" : "gap-3"
                )}
              >
                <i className="ri-global-line text-base shrink-0" />
                {!collapsed && <span className="tracking-wide">{viewSiteLabel}</span>}
              </Link>
            </SidebarTooltip>

            <SidebarTooltip label={signOutLabel} collapsed={collapsed}>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                className={cn(
                  "w-full text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  collapsed
                    ? "size-9 shrink-0 justify-center"
                    : "justify-start gap-3 px-3 py-2.5 h-auto"
                )}
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
              >
                <i className="ri-logout-box-r-line text-base shrink-0" />
                {!collapsed && <span className="tracking-wide">{signOutLabel}</span>}
              </Button>
            </SidebarTooltip>

            <SidebarTooltip label={localeLabel} collapsed={collapsed}>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                className={cn(
                  "text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200",
                  collapsed
                    ? "size-9 shrink-0"
                    : "w-full justify-start gap-3 px-3 py-2.5 h-auto"
                )}
                onClick={onToggleLocale}
              >
                <i className="ri-translate-2 text-base shrink-0" />
                {!collapsed && <span className="tracking-wide">{localeSwitch}</span>}
              </Button>
            </SidebarTooltip>

          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
