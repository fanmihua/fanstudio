"use client"

import type { KeyboardEvent, MouseEvent } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type ContentFilterOption = {
  id: string
  label: string
}

type ContentFilterGroupProps = {
  label: string
  allLabel: string
  options: ContentFilterOption[]
  value: string
  onChange: (value: string) => void
}

/** 列表页分类 / 标签筛选。分类与标签可同时生效。 */
export function ContentFilterGroup({
  label,
  allLabel,
  options,
  value,
  onChange,
}: ContentFilterGroupProps) {
  if (options.length === 0) return null

  const allValue = "__all__"

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        value={value || allValue}
        onValueChange={(nextValue) => onChange(nextValue === allValue ? "" : nextValue)}
      >
        <SelectTrigger
          size="sm"
          aria-label={label}
          className="min-w-[7.5rem] rounded-full border-border/70 bg-background/70 px-3 text-xs shadow-none transition-colors hover:border-foreground/25 hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-foreground/15"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end" className="min-w-[10rem] rounded-xl p-1">
          <SelectItem value={allValue} className="rounded-lg text-xs">
            {allLabel}
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id} className="rounded-lg text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

type SelectableMetaPillProps = {
  label: string
  active?: boolean
  tone?: "category" | "tag"
  className?: string
  onSelect: () => void
}

/** 卡片内可点击的分类 / 标签；阻止父级卡片链接或展开按钮响应。 */
export function SelectableMetaPill({
  label,
  active = false,
  tone = "tag",
  className = "",
  onSelect,
}: SelectableMetaPillProps) {
  const activate = (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onSelect()
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={active}
      title={label}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") activate(event)
      }}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] leading-tight font-medium shrink-0 cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 hover:-translate-y-px hover:border-foreground/30 hover:bg-foreground/10 hover:text-foreground ${
        tone === "category" ? "content-meta-pill-primary" : "content-meta-pill-muted"
      } ${active ? "border-foreground/30 bg-foreground/10 text-foreground ring-1 ring-foreground/15" : ""} ${className}`}
    >
      {label}
    </span>
  )
}
