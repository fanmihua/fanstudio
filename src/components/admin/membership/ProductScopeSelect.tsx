"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import { cn } from "@/lib/utils"

export interface MembershipProductOption {
  key: string
  name: string
  enabled?: boolean
}

export function ProductScopeSelect({
  products,
  value,
  onValueChange,
  loading = false,
  className,
}: {
  products: MembershipProductOption[]
  value: string
  onValueChange: (value: string) => void
  loading?: boolean
  className?: string
}) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)

  return (
    <Select value={value} onValueChange={onValueChange} disabled={loading || products.length === 0}>
      <SelectTrigger className={cn("h-9 w-full min-w-[220px] sm:w-[260px]", className)}>
        <SelectValue placeholder={loading ? t("加载产品…", "Loading products…") : t("选择产品", "Select product")} />
      </SelectTrigger>
      <SelectContent>
        {products.map((product) => (
          <SelectItem key={product.key} value={product.key}>
            {product.name}
            {product.enabled === false ? t("（停用）", " (off)") : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
