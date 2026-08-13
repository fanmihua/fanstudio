"use client"
/** 分类选择下拉（Command）：按 type 拉取分类列表，支持搜索。 */
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
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

type CategoryItem = { id: string; name: string; slug: string }

interface CategoryComboboxProps {
  /** 分类类型，如 POST、DESIGN、DEVELOPMENT、TUTORIAL */
  type: string
  /** 当前选中的 categoryId */
  value: string
  /** 选中回调 */
  onChange: (id: string) => void
  /** 占位文字 */
  placeholder?: string
  className?: string
}

export function CategoryCombobox({
  type,
  value,
  onChange,
  placeholder,
  className,
}: CategoryComboboxProps) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const placeholderText = placeholder ?? t("选择分类", "Select category")
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchCategories = useCallback(() => {
    fetch(`/api/categories?type=${type}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
  }, [type])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const selectedName = categories.find((c) => c.id === value)?.name

  async function handleCreate() {
    const name = search.trim()
    if (!name) return
    setCreating(true)
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, type }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("创建分类失败", "Failed to create category"))
        return
      }
      // 追加到列表并选中
      setCategories((prev) => [...prev, data])
      onChange(data.id)
      setSearch("")
      setOpen(false)
      toast.success(locale === "en" ? `Category "${name}" created` : `分类「${name}」已创建`)
    } catch {
      toast.error(t("网络错误，请重试", "Network error, please try again"))
    } finally {
      setCreating(false)
    }
  }

  // 判断搜索词是否精确匹配已有分类
  const exactMatch = categories.some(
    (c) => c.name.toLowerCase() === search.trim().toLowerCase()
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selectedName || placeholderText}</span>
          <i className="ri-expand-up-down-line ml-2 shrink-0 text-muted-foreground text-sm" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={t("搜索或创建分类…", "Search or create category…")}
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
                <span className="text-muted-foreground">{t("暂无分类", "No categories")}</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {categories.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onChange(c.id === value ? "" : c.id)
                    setSearch("")
                    setOpen(false)
                  }}
                >
                  <i
                    className={cn(
                      "ri-check-line text-sm shrink-0",
                      c.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {c.name}
                </CommandItem>
              ))}
              {/* 搜索词不为空且没有精确匹配时，在列表底部也显示创建入口 */}
              {search.trim() && !exactMatch && categories.length > 0 && (
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
  )
}
