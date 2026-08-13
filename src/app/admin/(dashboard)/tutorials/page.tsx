"use client"
/** 视频教程管理：列表、筛选、拖拽排序、批量删除、编辑入口。 */
import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AdminThumbnail } from "@/components/admin/AdminThumbnail"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DndSortProvider, SortableTableBody } from "@/components/admin/SortableTable"
import { useTableControls } from "@/hooks/useTableControls"
import { TableToolbar, type BatchAction } from "@/components/admin/TableToolbar"
import { TablePagination } from "@/components/admin/TablePagination"
import { SortableTableHead } from "@/components/admin/SortableTableHead"
import { ConfirmPopover } from "@/components/admin/ConfirmPopover"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type Tutorial = {
  id: string
  title: string
  slug: string
  thumbnail?: string | null
  videoUrl: string
  sortOrder: number
  createdAt: string
  category?: { name: string } | null
  likeCount?: number
}

export default function TutorialsPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const router = useRouter()
  const [list, setList] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  const tc = useTableControls<Tutorial>({
    data: list,
    searchFields: ["title"],
    defaultPageSize: 20,
  })

  const toolbarFilters = useMemo(() => {
    if (categories.length === 0) return []
    return [{
      key: "category.name",
      label: t("分类", "Category"),
      options: categories.map((c) => ({ label: c, value: c })),
    }]
  }, [categories])

  const batchActions: BatchAction[] = useMemo(() => [
    {
      label: t("删除", "Delete"), icon: "ri-delete-bin-line", variant: "destructive" as const, onClick: handleBatchDelete,
      needConfirm: true, confirmTitle: t(`确定删除选中的 ${tc.selectedIds.size} 个教程？`, `Delete ${tc.selectedIds.size} selected tutorials?`), confirmDescription: t("删除后不可恢复", "This action cannot be undone"),
    },
  ], [tc.selectedIds, locale])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/tutorials", { credentials: "include" })
      if (!res.ok) { router.push("/admin/login"); return }
      const data = await res.json()
      const items: Tutorial[] = Array.isArray(data) ? data : []
      setList(items)
      setCategories([...new Set(items.map((t) => t.category?.name).filter(Boolean))] as string[])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function saveSort(id: string, sortOrder: number) {
    try {
      const res = await fetch(`/api/tutorials/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ sortOrder }),
      })
      if (!res.ok) toast.error(t("排序保存失败", "Failed to save sort order"))
    } catch { toast.error(t("网络错误", "Network error")) }
  }

  function handleReorder(reordered: Tutorial[]) {
    const prev = list
    setList(reordered)
    reordered.filter((item, idx) => {
      const old = prev.find((t) => t.id === item.id)
      return old && old.sortOrder !== idx
    }).forEach((item) => saveSort(item.id, item.sortOrder))
  }

  async function createDraft() {
    setCreating(true)
    try {
      const res = await fetch("/api/tutorials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: t("无标题教程", "Untitled Tutorial"), slug: `draft-${Date.now()}`, videoUrl: "" }),
      })
      const data = await res.json()
      if (res.ok && data?.id) router.push(`/admin/tutorials/${data.id}/edit`)
      else toast.error(data?.error || t("创建失败", "Create failed"))
    } catch { toast.error(t("网络错误", "Network error")) }
    finally { setCreating(false) }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tutorials/${id}`, { method: "DELETE", credentials: "include" })
      if (res.ok) setList((prev) => prev.filter((t) => t.id !== id))
      else { const err = await res.json().catch(() => ({})); toast.error(err.error || t("删除失败", "Delete failed")) }
    } finally { setDeletingId(null) }
  }

  async function handleBatchDelete() {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/tutorials/batch", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ ids }),
      })
      if (res.ok) { setList((prev) => prev.filter((t) => !ids.includes(t.id))); tc.clearSelection(); toast.success(t(`已删除 ${ids.length} 个教程`, `${ids.length} tutorials deleted`)) }
      else toast.error(t("批量删除失败", "Batch delete failed"))
    } catch { toast.error(t("网络错误", "Network error")) }
  }

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) }
    catch { return dateStr }
  }

  function renderCells(item: Tutorial) {
    return (
      <>
        <TableCell>
          <div className="flex items-center gap-3">
            <AdminThumbnail src={item.thumbnail} fallbackIcon="ri-video-line" className="w-10 h-10" />
            <div className="min-w-0">
              <span className="font-medium truncate block">{item.title}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <i className="ri-heart-3-line" /> {item.likeCount ?? 0}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell>{item.category?.name ?? "-"}</TableCell>
        <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
          {item.videoUrl || "-"}
        </TableCell>
        <TableCell>{formatDate(item.createdAt)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/admin/tutorials/${item.id}/edit`}><i className="ri-edit-line" /></Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/tutorials#${item.slug}`} target="_blank"><i className="ri-eye-line" /></Link>
            </Button>
            <ConfirmPopover
              title={t("确定删除该教程？", "Delete this tutorial?")}
              description={t("删除后不可恢复", "This action cannot be undone")}
              confirmText={t("删除", "Delete")}
              onConfirm={() => handleDelete(item.id)}
              align="end"
            >
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0" disabled={deletingId === item.id}>
                <i className={deletingId === item.id ? "ri-loader-4-line animate-spin" : "ri-delete-bin-line"} />
              </Button>
            </ConfirmPopover>
          </div>
        </TableCell>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">{t("视频教程", "Tutorials")}</h1>
          <p className="text-muted-foreground mt-1">{t("管理视频教程合集", "Manage tutorial collection")}</p>
        </div>
        <Button onClick={createDraft} disabled={creating}>
          {creating ? t("创建中…", "Creating…") : t("添加教程", "New Tutorial")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
        <TableToolbar
          searchValue={tc.searchTerm}
          onSearchChange={tc.setSearchTerm}
          searchPlaceholder={t("搜索教程标题…", "Search tutorial titles…")}
          filters={toolbarFilters}
          filterValues={tc.filters}
          onFilterChange={tc.setFilter}
          selectedCount={tc.selectedIds.size}
          batchActions={batchActions}
          onClearSelection={tc.clearSelection}
        />

        {tc.isFiltering && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground"><i className="ri-filter-line mr-1" />{t("筛选模式 · 拖拽排序已暂停", "Filter mode · drag sort paused")}</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={tc.resetFilters}>{t("清除筛选", "Clear filters")}</Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">{t("加载中…", "Loading…")}</div>
        ) : tc.isFiltering ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
                </TableHead>
                <SortableTableHead column="title" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Tutorial)}>{t("标题", "Title")}</SortableTableHead>
                <TableHead>{t("分类", "Category")}</TableHead>
                <TableHead>{t("链接", "Link")}</TableHead>
                <SortableTableHead column="createdAt" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Tutorial)}>{t("创建时间", "Created")}</SortableTableHead>
                <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tc.pagedData.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("无匹配结果", "No matches found")}</TableCell></TableRow>
              ) : tc.pagedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="w-[40px]"><Checkbox checked={tc.selectedIds.has(item.id)} onCheckedChange={() => tc.toggleSelect(item.id)} /></TableCell>
                  {renderCells(item)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <DndSortProvider items={list} onReorder={handleReorder}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
                  </TableHead>
                  <TableHead>{t("标题", "Title")}</TableHead>
                  <TableHead>{t("分类", "Category")}</TableHead>
                  <TableHead>{t("链接", "Link")}</TableHead>
                  <TableHead>{t("创建时间", "Created")}</TableHead>
                  <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <SortableTableBody items={list} columnCount={7} emptyText={t("暂无教程，点击「添加教程」添加", "No tutorials yet. Click \"New Tutorial\" to add one.")}>
                {(item) => (
                  <>
                    <TableCell className="w-[40px]">
                      <Checkbox checked={tc.selectedIds.has(item.id)} onCheckedChange={() => tc.toggleSelect(item.id)} />
                    </TableCell>
                    {renderCells(item)}
                  </>
                )}
              </SortableTableBody>
            </Table>
          </DndSortProvider>
        )}

        {tc.totalItems > 0 && (
          <TablePagination page={tc.page} pageSize={tc.pageSize} totalItems={tc.totalItems} totalPages={tc.totalPages} onPageChange={tc.setPage} onPageSizeChange={tc.setPageSize} />
        )}
      </div>
    </div>
  )
}
