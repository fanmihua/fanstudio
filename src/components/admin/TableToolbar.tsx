"use client"
/** 表格工具栏：搜索、筛选、批量操作（可带确认 Popover）。 */
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmPopover } from "@/components/admin/ConfirmPopover"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

export interface ToolbarFilter {
  key: string
  label: string
  options: { label: string; value: string }[]
}

export interface BatchAction {
  label: string
  icon?: string
  variant?: "default" | "destructive" | "outline" | "ghost"
  onClick: () => void
  /** Show a popover confirmation before executing */
  needConfirm?: boolean
  confirmTitle?: string
  confirmDescription?: string
}

interface TableToolbarProps {
  /** Search */
  searchValue: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string
  /** Filters */
  filters?: ToolbarFilter[]
  filterValues?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  /** Batch */
  selectedCount?: number
  batchActions?: BatchAction[]
  onClearSelection?: () => void
  /** Extra: right-side slot */
  extra?: React.ReactNode
}

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters = [],
  filterValues = {},
  onFilterChange,
  selectedCount = 0,
  batchActions = [],
  onClearSelection,
  extra,
}: TableToolbarProps) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const hasBatch = selectedCount > 0 && batchActions.length > 0
  const placeholder = searchPlaceholder ?? t("搜索…", "Search…")

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 h-9"
        />
      </div>

      {/* Filters */}
      {filters.map((f) => (
        <Select
          key={f.key}
          value={filterValues[f.key] || "all"}
          onValueChange={(v) => onFilterChange?.(f.key, v)}
        >
          <SelectTrigger className="w-auto min-w-[120px] h-9 text-sm">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("全部", "All")} {f.label}</SelectItem>
            {f.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Batch actions */}
      {hasBatch && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            {t("已选", "Selected")} {selectedCount} {t("项", "items")}
          </span>
          {batchActions.map((action) => {
            const btn = (
              <Button
                key={action.label}
                variant={(action.variant as "default") || "outline"}
                size="sm"
                className="h-8 text-xs"
                {...(!action.needConfirm ? { onClick: action.onClick } : {})}
              >
                {action.icon && <i className={`${action.icon} mr-1`} />}
                {action.label}
              </Button>
            )
            if (action.needConfirm) {
              return (
                <ConfirmPopover
                  key={action.label}
                  title={action.confirmTitle || t(`确定${action.label}？`, `Confirm ${action.label}?`)}
                  description={action.confirmDescription}
                  confirmText={action.label}
                  variant={action.variant === "destructive" ? "destructive" : "default"}
                  onConfirm={action.onClick}
                  align="end"
                >
                  {btn}
                </ConfirmPopover>
              )
            }
            return btn
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onClearSelection}
          >
            {t("取消选择", "Clear")}
          </Button>
        </div>
      )}

      {/* Extra slot */}
      {!hasBatch && extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
    </div>
  )
}
