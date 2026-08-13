"use client"
/** 可点击排序的表头，与 useTableControls 的 sort 状态联动。 */
import { cn } from "@/lib/utils"
import { TableHead } from "@/components/ui/table"
import type { SortDirection } from "@/hooks/useTableControls"

interface SortableTableHeadProps {
  children: React.ReactNode
  column: string
  currentSort: string | null
  currentDirection: SortDirection
  onToggle: (column: string) => void
  className?: string
}

export function SortableTableHead({
  children,
  column,
  currentSort,
  currentDirection,
  onToggle,
  className,
}: SortableTableHeadProps) {
  const isActive = currentSort === column

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => onToggle(column)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="inline-flex flex-col text-[10px] leading-none">
          <i
            className={cn(
              "ri-arrow-up-s-fill",
              isActive && currentDirection === "asc"
                ? "text-foreground"
                : "text-muted-foreground/30"
            )}
          />
          <i
            className={cn(
              "ri-arrow-down-s-fill -mt-1",
              isActive && currentDirection === "desc"
                ? "text-foreground"
                : "text-muted-foreground/30"
            )}
          />
        </span>
      </span>
    </TableHead>
  )
}
