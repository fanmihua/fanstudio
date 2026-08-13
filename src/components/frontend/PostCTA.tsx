import Link from "next/link"
import { SiteStatBadge } from "@/components/stats/SiteStatBadge"

/**
 * 文章文末产品按钮。由 product.landingPath 决定跳转目标。
 * 按钮下方挂站点统计徽标（访问/通行人数，宣传用），社会证明贴着转化点。
 * 仅当配了产品、产品启用且有 landingPath 时渲染；否则什么都不显示。
 */
export function PostCTA({
  product,
  label,
}: {
  product?: { name: string; landingPath: string | null; enabled: boolean } | null
  label?: string | null
}) {
  if (!product || !product.enabled || !product.landingPath) return null
  return (
    <div className="my-12 flex flex-wrap items-center justify-between gap-4">
      <Link
        href={product.landingPath}
        className="group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        {label || `进入${product.name}`}
        <i className="ri-arrow-right-line transition-transform group-hover:translate-x-0.5" />
      </Link>
      <SiteStatBadge />
    </div>
  )
}
