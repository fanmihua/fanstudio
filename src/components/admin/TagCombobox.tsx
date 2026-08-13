"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type TagItem = { id: string; name: string }

interface TagComboboxProps {
  /** 当前选中的 tag id 数组 */
  value: string[]
  /** 选中回调 */
  onChange: (ids: string[]) => void
  /** 占位文字 */
  placeholder?: string
  className?: string
}

export function TagCombobox({
  value,
  onChange,
  placeholder,
  className,
}: TagComboboxProps) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const placeholderText = placeholder ?? t("选择标签", "Select tags")
  const [open, setOpen] = useState(false)
  const [tags, setTags] = useState<TagItem[]>([])
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchTags = useCallback(() => {
    fetch("/api/tags", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setTags(Array.isArray(data) ? data : []))
      .catch(() => setTags([]))
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const selectedTags = tags.filter((t) => value.includes(t.id))

  function handleToggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  function handleRemove(id: string) {
    onChange(value.filter((v) => v !== id))
  }

  async function handleCreate() {
    const name = search.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("创建标签失败", "Failed to create tag"))
        return
      }
      // 追加到列表并选中
      setTags((prev) => [...prev, data])
      onChange([...value, data.id])
      setSearch("")
      toast.success(locale === "en" ? `Tag "${name}" created` : `标签「${name}」已创建`)
    } catch {
      toast.error(t("网络错误，请重试", "Network error, please try again"))
    } finally {
      setCreating(false)
    }
  }

  // 判断搜索词是否精确匹配已有标签
  const exactMatch = tags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase()
  )

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              value.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {value.length > 0
                ? t(`已选 ${value.length} 个标签`, `${value.length} tags selected`)
                : placeholderText}
            </span>
            <i className="ri-expand-up-down-line ml-2 shrink-0 text-muted-foreground text-sm" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput
              placeholder={t("搜索或创建标签…", "Search or create tags…")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty className="py-2 px-3 text-left">
                {search.trim() ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm cursor-pointer disabled:opacity-50"
                    disabled={creating}
                    onClick={handleCreate}
                  >
                    <i className="ri-add-line text-primary shrink-0" />
                    <span>
                      {creating ? t("创建中…", "Creating…") : <>{t("创建「", "Create \"")}<span className="font-medium">{search.trim()}</span>{t("」", "\"")}</>}
                    </span>
                  </button>
                ) : (
                  <span className="text-muted-foreground">{t("暂无标签", "No tags")}</span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {tags.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.name}
                    onSelect={() => handleToggle(t.id)}
                  >
                    <i
                      className={cn(
                        "ri-check-line text-sm shrink-0",
                        value.includes(t.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {t.name}
                  </CommandItem>
                ))}
                {/* 搜索词不为空且没有精确匹配时，在列表底部也显示创建入口 */}
                {search.trim() && !exactMatch && tags.length > 0 && (
                  <CommandItem
                    value={`__create__${search.trim()}`}
                    onSelect={handleCreate}
                    className="text-primary"
                  >
                    <i className="ri-add-line shrink-0" />
                    {creating ? t("创建中…", "Creating…") : <>{t("创建「", "Create \"")}{search.trim()}{t("」", "\"")}</>}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 已选标签展示 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((t) => (
            <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
              {t.name}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                onClick={() => handleRemove(t.id)}
              >
                <i className="ri-close-line text-xs" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
