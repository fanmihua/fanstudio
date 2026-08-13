"use client"
/** 分类与标签管理：文章/设计/开发/教程分类及标签的增删改、批量删除。 */
import React, { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TableToolbar, type BatchAction } from "@/components/admin/TableToolbar"
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type RelatedItem = { id: string; title: string; entityType: string }
type I18nText = { zh?: string | null; en?: string | null } | null

type CategoryItem = {
  id: string
  name: string
  slug: string
  nameI18n?: I18nText
  slugI18n?: I18nText
  type: string
  count: number
  items: RelatedItem[]
}

type TagItem = {
  id: string
  name: string
  nameI18n?: I18nText
  count: number
  items: RelatedItem[]
}

function getEditLink(item: RelatedItem): string {
  switch (item.entityType) {
    case "post":
      return `/admin/posts/${item.id}/edit`
    case "design":
    case "development":
      return `/admin/works/${item.id}/edit`
    case "tutorial":
      return `/admin/tutorials/${item.id}/edit`
    default:
      return "#"
  }
}

function getEntityLabel(entityType: string, locale: "zh" | "en"): string {
  switch (entityType) {
    case "post": return locale === "en" ? "Post" : "文章"
    case "design": return locale === "en" ? "Design" : "设计"
    case "development": return locale === "en" ? "Development" : "开发"
    case "tutorial": return locale === "en" ? "Tutorial" : "教程"
    default: return ""
  }
}

function getCategoryTypeLabel(type: string, locale: "zh" | "en"): string {
  switch (type) {
    case "POST":
      return locale === "en" ? "Post" : "文章"
    case "DESIGN":
      return locale === "en" ? "Design Work" : "设计作品"
    case "DEVELOPMENT":
      return locale === "en" ? "Development Work" : "开发作品"
    case "TUTORIAL":
      return locale === "en" ? "Tutorial" : "视频教程"
    default:
      return locale === "en" ? "Work" : "作品"
  }
}

export default function CategoriesPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  // ===== 分类状态 =====
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [createCatOpen, setCreateCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatNameEn, setNewCatNameEn] = useState("")
  const [newCatType, setNewCatType] = useState("POST")
  const [savingCat, setSavingCat] = useState(false)
  const [editCat, setEditCat] = useState<CategoryItem | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatNameEn, setEditCatNameEn] = useState("")
  const [editCatSlug, setEditCatSlug] = useState("")
  const [savingEditCat, setSavingEditCat] = useState(false)
  const [deleteCat, setDeleteCat] = useState<CategoryItem | null>(null)
  const [deletingCat, setDeletingCat] = useState(false)
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)
  const [catSearch, setCatSearch] = useState("")
  const [catTypeFilter, setCatTypeFilter] = useState("all")
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set())

  // ===== 标签状态 =====
  const [tags, setTags] = useState<TagItem[]>([])
  const [loadingTags, setLoadingTags] = useState(true)
  const [createTagOpen, setCreateTagOpen] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [newTagNameEn, setNewTagNameEn] = useState("")
  const [savingTag, setSavingTag] = useState(false)
  const [editTag, setEditTag] = useState<TagItem | null>(null)
  const [editTagName, setEditTagName] = useState("")
  const [editTagNameEn, setEditTagNameEn] = useState("")
  const [savingEditTag, setSavingEditTag] = useState(false)
  const [deleteTag, setDeleteTag] = useState<TagItem | null>(null)
  const [deletingTag, setDeletingTag] = useState(false)
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null)
  const [tagSearch, setTagSearch] = useState("")

  // ===== 数据加载 =====
  const fetchCategories = useCallback(() => {
    setLoadingCats(true)
    return fetch("/api/categories", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false))
  }, [])

  const fetchTags = useCallback(() => {
    setLoadingTags(true)
    return fetch("/api/tags", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setTags(Array.isArray(data) ? data : []))
      .catch(() => setTags([]))
      .finally(() => setLoadingTags(false))
  }, [])

  useEffect(() => {
    fetchCategories()
    fetchTags()
  }, [fetchCategories, fetchTags])

  // ===== 分类操作 =====
  async function handleCreateCategory() {
    if (!newCatName.trim()) return
    setSavingCat(true)
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newCatName.trim(),
          type: newCatType,
          nameI18n: { zh: newCatName.trim(), en: newCatNameEn.trim() || undefined },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("创建失败", "Create failed"))
        return
      }
      setNewCatName("")
      setNewCatNameEn("")
      setCreateCatOpen(false)
      toast.success(t("分类已创建", "Category created"))
      fetchCategories()
    } finally {
      setSavingCat(false)
    }
  }

  async function handleEditCategory() {
    if (!editCat || !editCatName.trim()) return
    setSavingEditCat(true)
    try {
      const res = await fetch(`/api/categories/${editCat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editCatName.trim(),
          slug: editCatSlug.trim(),
          nameI18n: { zh: editCatName.trim(), en: editCatNameEn.trim() || undefined },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("更新失败", "Update failed"))
        return
      }
      setEditCat(null)
      toast.success(t("分类已更新", "Category updated"))
      fetchCategories()
    } finally {
      setSavingEditCat(false)
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCat) return
    setDeletingCat(true)
    try {
      const res = await fetch(`/api/categories/${deleteCat.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("删除失败", "Delete failed"))
        return
      }
      setDeleteCat(null)
      toast.success(t("分类已删除", "Category deleted"))
      fetchCategories()
    } finally {
      setDeletingCat(false)
    }
  }

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const term = catSearch.trim().toLowerCase()
      const names = [cat.name, cat.nameI18n?.zh, cat.nameI18n?.en].filter(Boolean).join(" ").toLowerCase()
      const matchSearch = !term || names.includes(term)
      const matchType = catTypeFilter === "all" || cat.type === catTypeFilter
      return matchSearch && matchType
    })
  }, [categories, catSearch, catTypeFilter])

  function toggleSelectCat(id: string) {
    setSelectedCatIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAllCatsSelected = filteredCategories.length > 0 && filteredCategories.every((c) => selectedCatIds.has(c.id))

  function toggleSelectAllCats() {
    if (isAllCatsSelected) {
      setSelectedCatIds((prev) => {
        const next = new Set(prev)
        filteredCategories.forEach((c) => next.delete(c.id))
        return next
      })
    } else {
      setSelectedCatIds((prev) => {
        const next = new Set(prev)
        filteredCategories.forEach((c) => next.add(c.id))
        return next
      })
    }
  }

  async function handleBatchDeleteCategories() {
    const ids = Array.from(selectedCatIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/categories/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      })
      if (res.ok) {
        setSelectedCatIds(new Set())
        toast.success(t(`已删除 ${ids.length} 个分类`, `Deleted ${ids.length} categories`))
        await fetchCategories()
      } else toast.error(t("批量删除失败", "Batch delete failed"))
    } catch { toast.error(t("网络错误", "Network error")) }
  }

  const catBatchActions: BatchAction[] = selectedCatIds.size > 0
    ? [{
        label: t("删除", "Delete"),
        icon: "ri-delete-bin-line",
        variant: "destructive" as const,
        onClick: handleBatchDeleteCategories,
        needConfirm: true,
        confirmTitle: t(
          `确定删除选中的 ${selectedCatIds.size} 个分类？`,
          `Delete ${selectedCatIds.size} selected categories?`,
        ),
        confirmDescription: t("其下内容将变为未分类", "Related content will become uncategorized"),
      }]
    : []

  // ===== 标签操作 =====
  async function handleCreateTag() {
    if (!newTagName.trim()) return
    setSavingTag(true)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newTagName.trim(),
          nameI18n: { zh: newTagName.trim(), en: newTagNameEn.trim() || undefined },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("创建失败", "Create failed"))
        return
      }
      setNewTagName("")
      setNewTagNameEn("")
      setCreateTagOpen(false)
      toast.success(t("标签已创建", "Tag created"))
      fetchTags()
    } finally {
      setSavingTag(false)
    }
  }

  async function handleEditTag() {
    if (!editTag || !editTagName.trim()) return
    setSavingEditTag(true)
    try {
      const res = await fetch(`/api/tags/${editTag.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editTagName.trim(),
          nameI18n: { zh: editTagName.trim(), en: editTagNameEn.trim() || undefined },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("更新失败", "Update failed"))
        return
      }
      setEditTag(null)
      toast.success(t("标签已更新", "Tag updated"))
      fetchTags()
    } finally {
      setSavingEditTag(false)
    }
  }

  async function handleDeleteTag() {
    if (!deleteTag) return
    setDeletingTag(true)
    try {
      const res = await fetch(`/api/tags/${deleteTag.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || t("删除失败", "Delete failed"))
        return
      }
      setDeleteTag(null)
      toast.success(t("标签已删除", "Tag deleted"))
      fetchTags()
    } finally {
      setDeletingTag(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
          {t("分类与标签", "Categories & Tags")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("管理文章和作品的分类与标签", "Manage categories and tags for posts and works")}</p>
      </div>

      <Tabs defaultValue="categories" className="space-y-6">
        <TabsList>
          <TabsTrigger value="categories">{t("分类管理", "Categories")}</TabsTrigger>
          <TabsTrigger value="tags">{t("标签管理", "Tags")}</TabsTrigger>
        </TabsList>

        {/* ==================== 分类 Tab ==================== */}
        <TabsContent value="categories" className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
            <TableToolbar
              searchValue={catSearch}
              onSearchChange={setCatSearch}
              searchPlaceholder={t("搜索分类名称…", "Search category name…")}
              filters={[{
                key: "type",
                label: t("类型", "Type"),
                options: [
                  { label: t("文章", "Post"), value: "POST" },
                  { label: t("设计作品", "Design Work"), value: "DESIGN" },
                  { label: t("开发作品", "Development Work"), value: "DEVELOPMENT" },
                  { label: t("视频教程", "Tutorial"), value: "TUTORIAL" },
                ],
              }]}
              filterValues={{ type: catTypeFilter }}
              onFilterChange={(_, v) => setCatTypeFilter(v)}
              selectedCount={selectedCatIds.size}
              batchActions={catBatchActions}
              onClearSelection={() => setSelectedCatIds(new Set())}
              extra={<Button onClick={() => { setNewCatName(""); setNewCatNameEn(""); setCreateCatOpen(true) }}>{t("新建分类", "New Category")}</Button>}
            />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={isAllCatsSelected} onCheckedChange={toggleSelectAllCats} />
                  </TableHead>
                  <TableHead>{t("名称", "Name")}</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>{t("类型", "Type")}</TableHead>
                  <TableHead>{t("数量", "Count")}</TableHead>
                  <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCats ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("加载中…", "Loading…")}</TableCell>
                  </TableRow>
                ) : filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {categories.length === 0 ? t("暂无分类", "No categories yet") : t("无匹配结果", "No matches found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((cat) => (
                    <React.Fragment key={cat.id}>
                      <TableRow>
                        <TableCell className="w-[40px]">
                          <Checkbox checked={selectedCatIds.has(cat.id)} onCheckedChange={() => toggleSelectCat(cat.id)} />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{cat.name}</div>
                          {cat.nameI18n?.en && cat.nameI18n.en !== cat.name && (
                            <div className="text-xs font-normal text-muted-foreground">{cat.nameI18n.en}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {cat.slug}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getCategoryTypeLabel(cat.type, locale)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {cat.count > 0 ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-sm underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground cursor-pointer transition-colors"
                              onClick={() => setExpandedCatId(expandedCatId === cat.id ? null : cat.id)}
                            >
                              {cat.count}
                              <i className={`ri-arrow-${expandedCatId === cat.id ? "up" : "down"}-s-line text-xs text-muted-foreground`} />
                            </button>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">•••</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditCatName(cat.name)
                                  setEditCatNameEn(cat.nameI18n?.en ?? "")
                                  setEditCatSlug(cat.slug)
                                  setEditCat(cat)
                                }}
                              >
                                {t("编辑", "Edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteCat(cat)}
                              >
                                {t("删除", "Delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {expandedCatId === cat.id && cat.items.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-accent/20 px-6 py-3">
                            <div className="space-y-1">
                              {cat.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-2 text-sm">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                    {getEntityLabel(item.entityType, locale)}
                                  </Badge>
                                  <Link
                                    href={getEditLink(item)}
                                    className="text-foreground hover:underline underline-offset-2 truncate"
                                  >
                                    {item.title || t("无标题", "Untitled")}
                                  </Link>
                                </div>
                              ))}
                              {cat.count > cat.items.length && (
                                <p className="text-xs text-muted-foreground pt-1">
                                  {t(
                                    `还有 ${cat.count - cat.items.length} 项未显示`,
                                    `${cat.count - cat.items.length} more not shown`,
                                  )}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ==================== 标签 Tab ==================== */}
        <TabsContent value="tags" className="space-y-6">
          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
            <TagsTableSection
              tags={tags}
              loadingTags={loadingTags}
              tagSearch={tagSearch}
              setTagSearch={setTagSearch}
              expandedTagId={expandedTagId}
              setExpandedTagId={setExpandedTagId}
              setEditTagName={setEditTagName}
              setEditTagNameEn={setEditTagNameEn}
              setEditTag={setEditTag}
              setDeleteTag={setDeleteTag}
              setNewTagName={setNewTagName}
              setNewTagNameEn={setNewTagNameEn}
              setCreateTagOpen={setCreateTagOpen}
              fetchTags={fetchTags}
              locale={locale}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== 新建分类 Dialog ==================== */}
      <Dialog open={createCatOpen} onOpenChange={setCreateCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("新建分类", "New Category")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="newCatName">{t("分类名称", "Category Name")}</Label>
              <Input
                id="newCatName"
                placeholder={t("输入分类名称", "Enter category name")}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCatNameEn">{t("英文名称", "English Name")}</Label>
              <Input
                id="newCatNameEn"
                placeholder={t("可选，用于前台英文展示", "Optional, used on English pages")}
                value={newCatNameEn}
                onChange={(e) => setNewCatNameEn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("分类类型", "Category Type")}</Label>
              <Select value={newCatType} onValueChange={setNewCatType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">{t("文章", "Post")}</SelectItem>
                  <SelectItem value="DESIGN">{t("设计作品", "Design Work")}</SelectItem>
                  <SelectItem value="DEVELOPMENT">{t("开发作品", "Development Work")}</SelectItem>
                  <SelectItem value="TUTORIAL">{t("视频教程", "Tutorial")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreateCategory} disabled={savingCat || !newCatName.trim()}>
              {savingCat ? t("创建中…", "Creating…") : t("创建", "Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== 编辑分类 Dialog ==================== */}
      <Dialog open={!!editCat} onOpenChange={(open) => !open && setEditCat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("编辑分类", "Edit Category")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="editCatName">{t("分类名称", "Category Name")}</Label>
              <Input
                id="editCatName"
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCatNameEn">{t("英文名称", "English Name")}</Label>
              <Input
                id="editCatNameEn"
                value={editCatNameEn}
                onChange={(e) => setEditCatNameEn(e.target.value)}
                placeholder={t("可选，用于前台英文展示", "Optional, used on English pages")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCatSlug">Slug</Label>
              <Input
                id="editCatSlug"
                value={editCatSlug}
                onChange={(e) => setEditCatSlug(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button className="w-full" onClick={handleEditCategory} disabled={savingEditCat || !editCatName.trim()}>
              {savingEditCat ? t("保存中…", "Saving…") : t("保存", "Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== 删除分类确认 ==================== */}
      <ConfirmActionDialog
        open={!!deleteCat}
        onOpenChange={(open) => !open && setDeleteCat(null)}
        title={t("确认删除分类", "Confirm Category Deletion")}
        description={
          deleteCat ? (
            <>
              {t(`确定要删除分类「${deleteCat.name}」吗？`, `Delete category "${deleteCat.name}"?`)}
              {deleteCat.count > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {t(
                    ` 该分类下有 ${deleteCat.count} 个内容，删除后这些内容将变为未分类。`,
                    ` This category has ${deleteCat.count} items. They will become uncategorized after deletion.`,
                  )}
                </span>
              )}
            </>
          ) : (
            ""
          )
        }
        confirmLabel={t("确认删除", "Confirm Delete")}
        loading={deletingCat}
        variant="destructive"
        onConfirm={handleDeleteCategory}
      />

      {/* ==================== 新建标签 Dialog ==================== */}
      <Dialog open={createTagOpen} onOpenChange={setCreateTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("新建标签", "New Tag")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="newTagName">{t("标签名称", "Tag Name")}</Label>
              <Input
                id="newTagName"
                placeholder={t("输入标签名称", "Enter tag name")}
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTagNameEn">{t("英文名称", "English Name")}</Label>
              <Input
                id="newTagNameEn"
                placeholder={t("可选，用于前台英文展示", "Optional, used on English pages")}
                value={newTagNameEn}
                onChange={(e) => setNewTagNameEn(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleCreateTag} disabled={savingTag || !newTagName.trim()}>
              {savingTag ? t("创建中…", "Creating…") : t("创建", "Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== 编辑标签 Dialog ==================== */}
      <Dialog open={!!editTag} onOpenChange={(open) => !open && setEditTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("编辑标签", "Edit Tag")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="editTagName">{t("标签名称", "Tag Name")}</Label>
              <Input
                id="editTagName"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditTag()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTagNameEn">{t("英文名称", "English Name")}</Label>
              <Input
                id="editTagNameEn"
                value={editTagNameEn}
                onChange={(e) => setEditTagNameEn(e.target.value)}
                placeholder={t("可选，用于前台英文展示", "Optional, used on English pages")}
              />
            </div>
            <Button className="w-full" onClick={handleEditTag} disabled={savingEditTag || !editTagName.trim()}>
              {savingEditTag ? t("保存中…", "Saving…") : t("保存", "Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== 删除标签确认 ==================== */}
      <ConfirmActionDialog
        open={!!deleteTag}
        onOpenChange={(open) => !open && setDeleteTag(null)}
        title={t("确认删除标签", "Confirm Tag Deletion")}
        description={
          deleteTag ? (
            <>
              {t(`确定要删除标签「${deleteTag.name}」吗？`, `Delete tag "${deleteTag.name}"?`)}
              {deleteTag.count > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {t(
                    ` 该标签已被 ${deleteTag.count} 篇文章使用，删除后将自动解除关联。`,
                    ` This tag is used by ${deleteTag.count} posts. Relations will be removed automatically.`,
                  )}
                </span>
              )}
            </>
          ) : (
            ""
          )
        }
        confirmLabel={t("确认删除", "Confirm Delete")}
        loading={deletingTag}
        variant="destructive"
        onConfirm={handleDeleteTag}
      />
    </div>
  )
}


function TagsTableSection({
  tags,
  loadingTags,
  tagSearch,
  setTagSearch,
  expandedTagId,
  setExpandedTagId,
  setEditTagName,
  setEditTagNameEn,
  setEditTag,
  setDeleteTag,
  setNewTagName,
  setNewTagNameEn,
  setCreateTagOpen,
  fetchTags,
  locale,
}: {
  tags: TagItem[]
  loadingTags: boolean
  tagSearch: string
  setTagSearch: (v: string) => void
  expandedTagId: string | null
  setExpandedTagId: (v: string | null) => void
  setEditTagName: (v: string) => void
  setEditTagNameEn: (v: string) => void
  setEditTag: (v: TagItem) => void
  setDeleteTag: (v: TagItem) => void
  setNewTagName: (v: string) => void
  setNewTagNameEn: (v: string) => void
  setCreateTagOpen: (v: boolean) => void
  fetchTags: () => void
  locale: "zh" | "en"
}) {
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const term = tagSearch.trim().toLowerCase()
    if (!term) return tags
    return tags.filter((tag) =>
      [tag.name, tag.nameI18n?.zh, tag.nameI18n?.en]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    )
  }, [tags, tagSearch])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAllSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id))

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((t) => next.delete(t.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filtered.forEach((t) => next.add(t.id))
        return next
      })
    }
  }

  async function handleBatchDeleteTags() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/tags/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      })
      if (res.ok) {
        setSelectedIds(new Set())
        toast.success(t(`已删除 ${ids.length} 个标签`, `Deleted ${ids.length} tags`))
        await fetchTags()
      } else toast.error(t("批量删除失败", "Batch delete failed"))
    } catch { toast.error(t("网络错误", "Network error")) }
  }

  const batchActions: BatchAction[] = selectedIds.size > 0
    ? [{
        label: t("删除", "Delete"), icon: "ri-delete-bin-line", variant: "destructive" as const, onClick: handleBatchDeleteTags,
        needConfirm: true, confirmTitle: t(`确定删除选中的 ${selectedIds.size} 个标签？`, `Delete ${selectedIds.size} selected tags?`), confirmDescription: t("删除后不可恢复", "This action cannot be undone"),
      }]
    : []

  return (
    <>
      <TableToolbar
        searchValue={tagSearch}
        onSearchChange={setTagSearch}
        searchPlaceholder={t("搜索标签名称…", "Search tag name…")}
        selectedCount={selectedIds.size}
        batchActions={batchActions}
        onClearSelection={() => setSelectedIds(new Set())}
        extra={<Button onClick={() => { setNewTagName(""); setNewTagNameEn(""); setCreateTagOpen(true) }}>{t("新建标签", "New Tag")}</Button>}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} />
            </TableHead>
            <TableHead>{t("名称", "Name")}</TableHead>
            <TableHead>{t("数量", "Count")}</TableHead>
            <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadingTags ? (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("加载中…", "Loading…")}</TableCell></TableRow>
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{tags.length === 0 ? t("暂无标签", "No tags yet") : t("无匹配标签", "No matching tags")}</TableCell></TableRow>
          ) : filtered.map((tag) => (
            <React.Fragment key={tag.id}>
              <TableRow>
                <TableCell className="w-[40px]">
                  <Checkbox checked={selectedIds.has(tag.id)} onCheckedChange={() => toggleSelect(tag.id)} />
                </TableCell>
                <TableCell className="font-medium">
                  <div>{tag.name}</div>
                  {tag.nameI18n?.en && tag.nameI18n.en !== tag.name && (
                    <div className="text-xs font-normal text-muted-foreground">{tag.nameI18n.en}</div>
                  )}
                </TableCell>
                <TableCell>
                  {tag.count > 0 ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground cursor-pointer transition-colors"
                      onClick={() => setExpandedTagId(expandedTagId === tag.id ? null : tag.id)}
                    >
                      {tag.count}
                      <i className={`ri-arrow-${expandedTagId === tag.id ? "up" : "down"}-s-line text-xs text-muted-foreground`} />
                    </button>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">•••</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditTagName(tag.name); setEditTagNameEn(tag.nameI18n?.en ?? ""); setEditTag(tag) }}>{t("编辑", "Edit")}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTag(tag)}>{t("删除", "Delete")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              {expandedTagId === tag.id && tag.items.length > 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="bg-accent/20 px-6 py-3">
                    <div className="space-y-1">
                      {tag.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{getEntityLabel(item.entityType, locale)}</Badge>
                          <Link href={getEditLink(item)} className="text-foreground hover:underline underline-offset-2 truncate">{item.title || t("无标题", "Untitled")}</Link>
                        </div>
                      ))}
                      {tag.count > tag.items.length && (
                        <p className="text-xs text-muted-foreground pt-1">{t(`还有 ${tag.count - tag.items.length} 项未显示`, `${tag.count - tag.items.length} more not shown`)}</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
