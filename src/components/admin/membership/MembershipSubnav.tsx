"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import { cn } from "@/lib/utils"

type MembershipSubnavGroup = "members" | "marketing" | "sales" | "logs"

type SubnavItem = {
  href: string
  icon: string
  zh: string
  en: string
}

const SUBNAV_ITEMS: Record<MembershipSubnavGroup, SubnavItem[]> = {
  members: [
    { href: "/admin/membership/members", icon: "ri-user-star-line", zh: "会员列表", en: "Members" },
    { href: "/admin/membership/orders", icon: "ri-bank-card-line", zh: "会员订单", en: "Orders" },
  ],
  marketing: [
    { href: "/admin/membership/promo-codes", icon: "ri-coupon-3-line", zh: "折扣码", en: "Promo codes" },
    { href: "/admin/membership/grant", icon: "ri-user-add-line", zh: "赠送开通", en: "Grant access" },
  ],
  sales: [
    { href: "/admin/membership/plans", icon: "ri-vip-crown-line", zh: "套餐价格", en: "Plans" },
    { href: "/admin/membership/products", icon: "ri-stack-line", zh: "产品设置", en: "Products" },
  ],
  logs: [
    { href: "/admin/membership/events", icon: "ri-file-list-3-line", zh: "事件日志", en: "Event logs" },
  ],
}

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MembershipSubnav({ group, className }: { group: MembershipSubnavGroup; className?: string }) {
  const pathname = usePathname()
  const { locale } = useAdminUiLocale()
  const items = SUBNAV_ITEMS[group]
  const activeHref = items.find((item) => pathMatches(pathname, item.href))?.href ?? items[0]?.href

  if (items.length <= 1) return null

  return (
    <Tabs value={activeHref} className={cn("overflow-x-auto pb-1", className)}>
      <TabsList className="h-10 w-fit">
        {items.map((item) => (
          <TabsTrigger key={item.href} value={item.href} asChild>
            <Link href={item.href} className="gap-2 px-3">
              <i className={`${item.icon} text-sm`} />
              <span>{locale === "en" ? item.en : item.zh}</span>
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
