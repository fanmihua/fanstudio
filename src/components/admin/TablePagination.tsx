"use client"
/** 表格分页：页码、每页条数选择。 */
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface TablePaginationProps {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const { locale } = useAdminUiLocale()
  if (totalItems === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
      <p className="text-xs text-muted-foreground tabular-nums">
        {locale === "en" ? `${start}–${end} of ${totalItems}` : `第 ${start}–${end} 条，共 ${totalItems} 条`}
      </p>

      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className="w-auto h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">{locale === "en" ? "10 / page" : "10 条/页"}</SelectItem>
            <SelectItem value="20">{locale === "en" ? "20 / page" : "20 条/页"}</SelectItem>
            <SelectItem value="50">{locale === "en" ? "50 / page" : "50 条/页"}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
          >
            <i className="ri-skip-back-mini-line text-sm" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <i className="ri-arrow-left-s-line text-sm" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <i className="ri-arrow-right-s-line text-sm" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            <i className="ri-skip-forward-mini-line text-sm" />
          </Button>
        </div>
      </div>
    </div>
  )
}
