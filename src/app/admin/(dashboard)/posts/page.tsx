"use client"
/** 文章管理：列表、筛选、拖拽排序、批量删除/发布、编辑入口。 */
import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { TableToolbar, type ToolbarFilter, type BatchAction } from "@/components/admin/TableToolbar"
import { TablePagination } from "@/components/admin/TablePagination"
import { SortableTableHead } from "@/components/admin/SortableTableHead"
import { ConfirmPopover } from "@/components/admin/ConfirmPopover"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type Post = {
  id: string
  title: string
  slug: string
  coverImage?: string | null
  status: string
  sortOrder: number
  createdAt: string
  category?: { name: string } | null
  likeCount?: number
}

export default function PostsPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [categories, setCategories] = useState<string[]>([])

  /* ---- table controls ---- */
  const tc = useTableControls<Post>({
    data: posts,
    searchFields: ["title"],
    defaultPageSize: 20,
  })

  /* ---- filters config ---- */
  const toolbarFilters: ToolbarFilter[] = useMemo(() => {
    const filters: ToolbarFilter[] = [
      {
        key: "status",
        label: t("状态", "Status"),
        options: [
          { label: t("已发布", "Published"), value: "PUBLISHED" },
          { label: t("草稿", "Draft"), value: "DRAFT" },
        ],
      },
    ]
    if (categories.length > 0) {
      filters.push({
        key: "category.name",
        label: t("分类", "Category"),
        options: categories.map((c) => ({ label: c, value: c })),
      })
    }
    return filters
  }, [categories, locale])

  /* ---- batch actions ---- */
  const batchActions: BatchAction[] = useMemo(() => [
    {
      label: t("发布", "Publish"),
      icon: "ri-check-line",
      onClick: () => handleBatchStatus("PUBLISHED"),
    },
    {
      label: t("转草稿", "Move to Draft"),
      icon: "ri-draft-line",
      onClick: () => handleBatchStatus("DRAFT"),
    },
    {
      label: t("删除", "Delete"),
      icon: "ri-delete-bin-line",
      variant: "destructive" as const,
      onClick: handleBatchDelete,
      needConfirm: true,
      confirmTitle: t(`确定删除选中的 ${tc.selectedIds.size} 篇文章？`, `Delete ${tc.selectedIds.size} selected posts?`),
      confirmDescription: t("删除后不可恢复", "This action cannot be undone"),
    },
  ], [tc.selectedIds])

  /* ---- data loading ---- */
  async function loadPosts() {
    setLoading(true)
    try {
      const res = await fetch("/api/posts?all=1", { credentials: "include" })
      if (!res.ok) { router.push("/admin/login"); return }
      const data = await res.json()
      const list: Post[] = Array.isArray(data) ? data : []
      setPosts(list)
      const cats = [...new Set(list.map((p) => p.category?.name).filter(Boolean))] as string[]
      setCategories(cats)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPosts() }, [])

  /* ---- sort persistence ---- */
  async function saveSort(id: string, sortOrder: number) {
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sortOrder }),
      })
      if (!res.ok) toast.error(t("排序保存失败", "Failed to save sort order"))
    } catch { toast.error(t("网络错误", "Network error")) }
  }

  function handleReorder(reordered: Post[]) {
    const prev = posts
    setPosts(reordered)
    const changed = reordered.filter((item, idx) => {
      const old = prev.find((p) => p.id === item.id)
      return old && old.sortOrder !== idx
    })
    changed.forEach((item) => saveSort(item.id, item.sortOrder))
  }

  /* ---- create ---- */
  async function createDraft() {
    setCreating(true)
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: t("无标题文章", "Untitled Post"), slug: `draft-${Date.now()}` }),
      })
      const data = await res.json()
      if (res.ok && data?.id) router.push(`/admin/posts/${data.id}/edit`)
      else toast.error(data?.error || t("创建失败", "Create failed"))
    } catch { toast.error(t("网络错误", "Network error")) }
    finally { setCreating(false) }
  }

  /* ---- single delete ---- */
  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE", credentials: "include" })
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id))
      else { const err = await res.json().catch(() => ({})); toast.error(err.error || t("删除失败", "Delete failed")) }
    } finally { setDeletingId(null) }
  }

  /* ---- batch operations ---- */
  async function handleBatchDelete() {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/posts/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      })
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => !ids.includes(p.id)))
        tc.clearSelection()
        toast.success(t(`已删除 ${ids.length} 篇文章`, `${ids.length} posts deleted`))
      } else toast.error(t("批量删除失败", "Batch delete failed"))
    } catch { toast.error(t("网络错误", "Network error")) }
  }

  async function handleBatchStatus(status: string) {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/posts/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, status }),
      })
      if (res.ok) {
        setPosts((prev) => prev.map((p) => ids.includes(p.id) ? { ...p, status } : p))
        tc.clearSelection()
        toast.success(t(`已更新 ${ids.length} 篇文章状态`, `${ids.length} posts updated`))
      } else toast.error(t("批量更新失败", "Batch update failed"))
    } catch { toast.error(t("网络错误", "Network error")) }
  }

  /* ---- helpers ---- */
  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
    } catch { return dateStr }
  }

  /* ---- render cells (shared between dnd and normal mode) ---- */
  function renderCells(post: Post) {
    return (
      <>
        <TableCell>
          <div className="flex items-center gap-3">
            <AdminThumbnail src={post.coverImage} fallbackIcon="ri-article-line" className="w-10 h-10" />
            <div className="min-w-0">
              <span className="font-medium truncate block">{post.title}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <i className="ri-heart-3-line" /> {post.likeCount ?? 0}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell>{post.category?.name ?? "-"}</TableCell>
        <TableCell>
          <Badge variant={post.status === "PUBLISHED" ? "default" : "secondary"}>
            {post.status === "PUBLISHED" ? t("已发布", "Published") : t("草稿", "Draft")}
          </Badge>
        </TableCell>
        <TableCell>{formatDate(post.createdAt)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/admin/posts/${post.id}/edit`}><i className="ri-edit-line" /></Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
              <Link href={`/blog/${post.slug}`} target="_blank"><i className="ri-eye-line" /></Link>
            </Button>
            <ConfirmPopover
              title={t("确定删除该文章？", "Delete this post?")}
              description={t("删除后不可恢复", "This action cannot be undone")}
              confirmText={t("删除", "Delete")}
              onConfirm={() => handleDelete(post.id)}
              align="end"
            >
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0" disabled={deletingId === post.id}>
                <i className={deletingId === post.id ? "ri-loader-4-line animate-spin" : "ri-delete-bin-line"} />
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
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">{t("文章管理", "Posts")}</h1>
          <p className="text-muted-foreground mt-1">{t("管理你的博客文章", "Manage your blog posts")}</p>
        </div>
        <Button onClick={createDraft} disabled={creating}>
          {creating ? t("创建中…", "Creating…") : t("写新文章", "New Post")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
        <TableToolbar
          searchValue={tc.searchTerm}
          onSearchChange={tc.setSearchTerm}
          searchPlaceholder={t("搜索文章标题…", "Search post titles…")}
          filters={toolbarFilters}
          filterValues={tc.filters}
          onFilterChange={tc.setFilter}
          selectedCount={tc.selectedIds.size}
          batchActions={batchActions}
          onClearSelection={tc.clearSelection}
        />

        {tc.isFiltering && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">
              <i className="ri-filter-line mr-1" />
              {t("筛选模式 · 拖拽排序已暂停", "Filter mode · drag sort paused")}
            </span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={tc.resetFilters}>
              {t("清除筛选", "Clear filters")}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">{t("加载中…", "Loading…")}</div>
        ) : tc.isFiltering ? (
          /* ---- Filter/search mode: normal table with sorting + checkbox ---- */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={tc.isAllSelected}
                    onCheckedChange={() => tc.toggleSelectAll()}
                  />
                </TableHead>
                <SortableTableHead column="title" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Post)}>
                  {t("标题", "Title")}
                </SortableTableHead>
                <SortableTableHead column="category.name" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Post)}>
                  {t("分类", "Category")}
                </SortableTableHead>
                <SortableTableHead column="status" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Post)}>
                  {t("状态", "Status")}
                </SortableTableHead>
                <SortableTableHead column="createdAt" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof Post)}>
                  {t("创建时间", "Created")}
                </SortableTableHead>
                <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tc.pagedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("无匹配结果", "No matches found")}
                  </TableCell>
                </TableRow>
              ) : tc.pagedData.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="w-[40px]">
                    <Checkbox
                      checked={tc.selectedIds.has(post.id)}
                      onCheckedChange={() => tc.toggleSelect(post.id)}
                    />
                  </TableCell>
                  {renderCells(post)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          /* ---- DnD mode: drag to reorder ---- */
          <DndSortProvider items={posts} onReorder={handleReorder}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
                  </TableHead>
                  <TableHead>{t("标题", "Title")}</TableHead>
                  <TableHead>{t("分类", "Category")}</TableHead>
                  <TableHead>{t("状态", "Status")}</TableHead>
                  <TableHead>{t("创建时间", "Created")}</TableHead>
                  <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <SortableTableBody items={posts} columnCount={7} emptyText={t("暂无文章，点击「写新文章」添加", "No posts yet. Click \"New Post\" to add one.")}>
                {(post) => (
                  <>
                    <TableCell className="w-[40px]">
                      <Checkbox checked={tc.selectedIds.has(post.id)} onCheckedChange={() => tc.toggleSelect(post.id)} />
                    </TableCell>
                    {renderCells(post)}
                  </>
                )}
              </SortableTableBody>
            </Table>
          </DndSortProvider>
        )}

        {tc.totalItems > 0 && (
          <TablePagination
            page={tc.page}
            pageSize={tc.pageSize}
            totalItems={tc.totalItems}
            totalPages={tc.totalPages}
            onPageChange={tc.setPage}
            onPageSizeChange={tc.setPageSize}
          />
        )}
      </div>
    </div>
  )
}
