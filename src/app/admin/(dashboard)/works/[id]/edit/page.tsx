"use client"
/** 作品编辑页：基础信息、版本与价格、交付链接、描述（BlockNote）。 */
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import type { Block } from "@blocknote/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Editor } from "@/components/admin/DynamicBlockNoteEditor"
import { CoverImageUpload } from "@/components/admin/CoverImageUpload"
import { MiniEditor } from "@/components/admin/MiniEditor"
import { CategoryCombobox } from "@/components/admin/CategoryCombobox"
import { TagCombobox } from "@/components/admin/TagCombobox"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import { getInitialContentForEditor } from "@/lib/content-format"
import { compressImageToDataUrl } from "@/lib/avatar-compress"
import {
  DEFAULT_COVER_RATIO,
  coverRatioToCss,
  getCoverRatioRecommendText,
  normalizeCoverRatio,
  type CoverRatioId,
} from "@/lib/cover-ratio"

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/[\u4e00-\u9fff]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || `work-${Date.now()}`
}

type VersionItem = {
  id: string
  version: string
  price: number
  changelog: string | null
  deliveryUrl: string | null
  figmaUrl: string | null
  fileUrl: string | null
  fileName: string | null
  createdAt: string
}

export default function EditWorkPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const [contentLocale, setContentLocale] = useState<"zh" | "en">(locale === "en" ? "en" : "zh")
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [title, setTitle] = useState("")
  const [titleEn, setTitleEn] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEn, setSlugEn] = useState("")
  const [description, setDescription] = useState("")
  const [descriptionEn, setDescriptionEn] = useState("")
  const [contentZh, setContentZh] = useState<Block[] | null>(null)
  const [contentEn, setContentEn] = useState<Block[] | null>(null)
  const [coverImage, setCoverImage] = useState("")
  const [figmaUrl, setFigmaUrl] = useState("")
  const [deliveryUrl, setDeliveryUrl] = useState("")
  const [demoUrl, setDemoUrl] = useState("")
  const [demoQrCode, setDemoQrCode] = useState("")
  const [currentVersion, setCurrentVersion] = useState("")
  const [versions, setVersions] = useState<VersionItem[]>([])
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [newVer, setNewVer] = useState({ version: "", price: "", changelog: "", figmaUrl: "", deliveryUrl: "" })
  const [publishingVersion, setPublishingVersion] = useState(false)
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null)
  const [editVer, setEditVer] = useState({ price: "", changelog: "", figmaUrl: "", deliveryUrl: "" })
  const [savingVersion, setSavingVersion] = useState(false)
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [price, setPrice] = useState("")
  const [isFree, setIsFree] = useState(false)
  const [workType, setWorkType] = useState<"DESIGN" | "DEVELOPMENT">("DESIGN")
  const [categoryId, setCategoryId] = useState("")
  const [tagIds, setTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT")
  const [originalSlug, setOriginalSlug] = useState("")
  const [deliveryRedacted, setDeliveryRedacted] = useState(false)
  const [coverRatioWorksDesign, setCoverRatioWorksDesign] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const [coverRatioWorksDev, setCoverRatioWorksDev] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!id || fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/works/${id}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then(async (work) => {
        setDeliveryRedacted(!!work._deliveryRedacted)
        setTitle(work.title ?? "")
        setTitleEn(work.titleI18n?.en ?? "")
        setSlug(work.slug ?? "")
        setSlugEn(work.slugI18n?.en ?? "")
        setOriginalSlug(work.slug ?? "")
        setWorkType(work.workType === "DEVELOPMENT" ? "DEVELOPMENT" : "DESIGN")
        setDescription(work.description ?? "")
        setDescriptionEn(work.descriptionI18n?.en ?? "")
        setContentZh(getInitialContentForEditor(work.contentI18n?.zh ?? work.content))
        setContentEn(getInitialContentForEditor(work.contentI18n?.en ?? null))
        setCoverImage(work.coverImage ?? "")
        setFigmaUrl(work.figmaUrl ?? "")
        setDeliveryUrl(work.deliveryUrl ?? "")
        setDemoUrl(work.demoUrl ?? "")
        setDemoQrCode(work.demoQrCode ?? "")
        setCurrentVersion(work.currentVersion ?? "")
        setPrice(work.price != null ? String(work.price) : "")
        setIsFree(!!work.isFree)
        setCategoryId(work.categoryId ?? "")
        setTagIds(Array.isArray(work.tags) ? work.tags.map((t: { id: string }) => t.id) : [])
        setCurrentStatus(work.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT")
        // 加载版本列表
        try {
          const vRes = await fetch(`/api/works/${id}/versions`, { credentials: "include" })
          if (vRes.ok) {
            const vData = await vRes.json()
            setVersions(vData)
            if (vData.length === 0) {
              setShowNewVersion(true)
              setNewVer({
                version: "1.0",
                price: work.isFree ? "0" : (work.price != null ? String(work.price) : ""),
                changelog: "",
                figmaUrl: work.figmaUrl ?? "",
                deliveryUrl: work.deliveryUrl ?? "",
              })
            }
          }
        } catch { /* ignore */ }
      })
      .catch(() => router.push("/admin/works"))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    setContentLocale(locale === "en" ? "en" : "zh")
  }, [locale])

  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const copy = data?.pageCopy && typeof data.pageCopy === "object"
          ? (data.pageCopy as Record<string, unknown>)
          : {}
        setCoverRatioWorksDesign(normalizeCoverRatio(copy.coverRatioWorksDesign))
        setCoverRatioWorksDev(normalizeCoverRatio(copy.coverRatioWorksDev))
      })
      .catch(() => {})
  }, [])

  const activeCoverRatio = workType === "DEVELOPMENT" ? coverRatioWorksDev : coverRatioWorksDesign

  function suggestNextVersion(): string {
    if (versions.length === 0) return "1.0"
    const latest = versions[0].version
    const parts = latest.split(".")
    const major = parseInt(parts[0], 10) || 1
    return `${major + 1}.0`
  }

  async function handlePublishVersion() {
    if (!newVer.version.trim()) {
      toast.error(t("请填写版本号", "Please enter version number"))
      return
    }
    const versionPrice = isFree ? 0 : parseFloat(newVer.price)
    if (!isFree && (isNaN(versionPrice) || !newVer.price.trim())) {
      toast.error(t("请填写有效的价格", "Please enter a valid price"))
      return
    }
    setPublishingVersion(true)
    try {
      const res = await fetch(`/api/works/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          version: newVer.version.trim(),
          price: versionPrice,
          changelog: newVer.changelog.trim() || null,
          figmaUrl: newVer.figmaUrl.trim() || null,
          deliveryUrl: newVer.deliveryUrl.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("发布版本失败", "Failed to publish version"))
        return
      }
      // 更新状态
      setVersions((prev) => [data, ...prev])
      setCurrentVersion(data.version)
      setPrice(String(data.price))
      if (data.figmaUrl) setFigmaUrl(data.figmaUrl)
      if (data.deliveryUrl) setDeliveryUrl(data.deliveryUrl)
      setShowNewVersion(false)
      setNewVer({ version: "", price: "", changelog: "", figmaUrl: "", deliveryUrl: "" })
      toast.success(t("版本已发布", "Version published"))
    } catch {
      toast.error(t("网络错误，请重试", "Network error, please try again"))
    } finally {
      setPublishingVersion(false)
    }
  }

  function startEditVersion(v: VersionItem) {
    setEditingVersionId(v.id)
    setEditVer({
      price: String(v.price),
      changelog: v.changelog ?? "",
      figmaUrl: v.figmaUrl ?? "",
      deliveryUrl: v.deliveryUrl ?? "",
    })
  }

  async function handleUpdateVersion(versionId: string) {
    const versionPrice = isFree ? 0 : parseFloat(editVer.price)
    if (!isFree && (isNaN(versionPrice) || !editVer.price.trim())) {
      toast.error(t("请填写有效的价格", "Please enter a valid price"))
      return
    }
    setSavingVersion(true)
    try {
      const res = await fetch(`/api/works/${id}/versions/${versionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          price: versionPrice,
          changelog: editVer.changelog.trim() || null,
          figmaUrl: editVer.figmaUrl.trim() || null,
          deliveryUrl: editVer.deliveryUrl.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("更新失败", "Update failed"))
        return
      }
      setVersions((prev) => prev.map((v) => (v.id === versionId ? data : v)))
      // 如果是当前最新版本，同步快捷字段
      if (data.version === currentVersion) {
        setPrice(String(data.price))
        if (data.figmaUrl !== undefined) setFigmaUrl(data.figmaUrl ?? "")
        if (data.deliveryUrl !== undefined) setDeliveryUrl(data.deliveryUrl ?? "")
      }
      setEditingVersionId(null)
      toast.success(t("版本已更新", "Version updated"))
    } catch {
      toast.error(t("网络错误，请重试", "Network error, please try again"))
    } finally {
      setSavingVersion(false)
    }
  }

  async function handleDeleteVersion(versionId: string) {
    setDeletingVersionId(versionId)
    try {
      const res = await fetch(`/api/works/${id}/versions/${versionId}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("删除失败", "Delete failed"))
        return
      }
      const deleted = versions.find((v) => v.id === versionId)
      setVersions((prev) => prev.filter((v) => v.id !== versionId))
      // 如果删除的是当前最新版本，回退到次新
      if (deleted && deleted.version === currentVersion) {
        const remaining = versions.filter((v) => v.id !== versionId)
        if (remaining.length > 0) {
          const next = remaining[0]
          setCurrentVersion(next.version)
          setPrice(String(next.price))
          setFigmaUrl(next.figmaUrl ?? "")
          setDeliveryUrl(next.deliveryUrl ?? "")
        } else {
          setCurrentVersion("")
          setPrice("")
          setFigmaUrl("")
          setDeliveryUrl("")
          setNewVer({ version: "1.0", price: isFree ? "0" : "", changelog: "", figmaUrl: "", deliveryUrl: "" })
        }
      }
      setConfirmDeleteId(null)
      toast.success(t("版本已删除", "Version deleted"))
    } catch {
      toast.error(t("网络错误，请重试", "Network error, please try again"))
    } finally {
      setDeletingVersionId(null)
    }
  }

  async function handleSave(status: "DRAFT" | "PUBLISHED") {
    if (!title.trim() || !slug.trim()) {
      toast.error(t("请填写作品名称和 slug", "Please fill work title and slug"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/works/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          workType,
          description: description.trim() || null,
          content: contentZh ?? undefined,
          coverImage: coverImage.trim() || "",
          figmaUrl: figmaUrl.trim() || null,
          deliveryUrl: deliveryUrl.trim() || null,
          demoUrl: demoUrl.trim() || null,
          demoQrCode: demoQrCode || null,
          price: isFree ? null : (parseFloat(price) || null),
          isFree,
          status,
          categoryId: categoryId || null,
          tagIds,
          titleI18n: {
            zh: title.trim(),
            en: titleEn.trim() || undefined,
          },
          slugI18n: {
            zh: slug.trim(),
            en: slugEn.trim() || undefined,
          },
          descriptionI18n: {
            zh: description.trim() || undefined,
            en: descriptionEn.trim() || undefined,
          },
          contentI18n: {
            zh: contentZh ?? undefined,
            en: contentEn ?? undefined,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || t("保存失败", "Save failed"))
        return
      }
      const listPath = workType === "DEVELOPMENT"
        ? "/admin/works/development"
        : "/admin/works/design"
      router.push(listPath)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {t("加载中…", "Loading…")}
      </div>
    )
  }

  return (
    <Tabs defaultValue="basic" className="space-y-0">
      {/* 吸顶头部 */}
      <div className="sticky top-0 z-10 -mx-6 md:-mx-8 lg:-mx-12 -mt-8 px-6 md:px-8 lg:px-12 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center justify-between py-3">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {t("编辑作品", "Edit Work")}
          </h1>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-border/70 p-1">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs ${contentLocale === "zh" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setContentLocale("zh")}
              >
                中文
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs ${contentLocale === "en" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setContentLocale("en")}
              >
                English
              </button>
            </div>
            <Button variant="outline" asChild>
              <Link href={workType === "DEVELOPMENT" ? "/admin/works/development" : "/admin/works/design"}>{t("取消", "Cancel")}</Link>
            </Button>
            <Button variant="secondary" onClick={() => handleSave("DRAFT")} disabled={saving}>
              {saving ? t("保存中…", "Saving…") : t("保存草稿", "Save Draft")}
            </Button>
            <Button onClick={() => handleSave("PUBLISHED")} disabled={saving}>
              {saving ? t("发布中…", "Publishing…") : currentStatus === "PUBLISHED" ? t("更新发布", "Update Published") : t("发布", "Publish")}
            </Button>
          </div>
        </div>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="basic">{t("基本信息", "Basic Info")}</TabsTrigger>
          <TabsTrigger value="content">{t("详细内容", "Details")}</TabsTrigger>
          {workType === "DESIGN" && (
            <TabsTrigger value="versions">{t("定价 & 版本", "Pricing & Versions")}</TabsTrigger>
          )}
          {workType === "DEVELOPMENT" && (
            <TabsTrigger value="demo">{t("在线体验", "Live Demo")}</TabsTrigger>
          )}
        </TabsList>
      </div>

      {/* ====== Tab 1: 基本信息 ====== */}
      <TabsContent value="basic" className="pt-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("作品名称", "Work Title")}</Label>
                  <Input
                    id="title"
                    value={contentLocale === "en" ? titleEn : title}
                    onChange={(e) => {
                      const newTitle = e.target.value
                      if (contentLocale === "en") {
                        setTitleEn(newTitle)
                        if (/^draft-\d+$/.test(slugEn) && newTitle.trim()) {
                          setSlugEn(titleToSlug(newTitle))
                        }
                      } else {
                        setTitle(newTitle)
                        if (/^draft-\d+$/.test(slug) && newTitle.trim()) {
                          setSlug(titleToSlug(newTitle))
                        }
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">{t("URL 别名（slug）", "URL Slug")}</Label>
                  <Input
                    id="slug"
                    placeholder={t("如 ios-weather-app", "e.g. ios-weather-app")}
                    value={contentLocale === "en" ? slugEn : slug}
                    onChange={(e) => {
                      const filtered = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, "-")
                        .replace(/-+/g, "-")
                        .replace(/^-/, "")
                      if (contentLocale === "en") setSlugEn(filtered)
                      else setSlug(filtered)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("仅支持小写英文、数字和短横线", "Only lowercase letters, numbers and hyphens are allowed")}
                    {(contentLocale === "en" ? slugEn : slug) && (
                      <> · {t("前台地址：", "Public URL: ")}<span className="font-mono text-foreground/70">/works/{contentLocale === "en" ? slugEn : slug}</span></>
                    )}
                  </p>
                  {currentStatus === "PUBLISHED" && slug !== originalSlug && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <i className="ri-alert-line text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t("修改已发布作品的 URL 别名会导致旧链接失效，请谨慎操作。", "Changing the slug of a published work may break old links.")}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("类型", "Type")}</Label>
                  <Select
                    value={workType}
                    onValueChange={(v) => setWorkType(v as "DESIGN" | "DEVELOPMENT")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DESIGN">{t("设计作品", "Design Work")}</SelectItem>
                      <SelectItem value="DEVELOPMENT">{t("开发作品", "Development Work")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("作品描述", "Description")}</Label>
                  <MiniEditor
                    value={contentLocale === "en" ? descriptionEn : description}
                    onChange={contentLocale === "en" ? setDescriptionEn : setDescription}
                    placeholder={t("简要描述作品亮点、适用场景等...", "Briefly describe highlights and use cases...")}
                    minHeight="min-h-[100px]"
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("分类", "Category")}</Label>
                    <CategoryCombobox
                      type={workType}
                      value={categoryId}
                      onChange={setCategoryId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("标签", "Tags")}</Label>
                    <TagCombobox
                      value={tagIds}
                      onChange={setTagIds}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader><CardTitle>{t("封面图", "Cover Image")}</CardTitle></CardHeader>
              <CardContent>
                <CoverImageUpload
                  value={coverImage}
                  onChange={setCoverImage}
                  entityType={workType === "DESIGN" ? "WORK_DESIGN" : "WORK_DEVELOPMENT"}
                  entityId={id}
                  aspectRatio={coverRatioToCss(activeCoverRatio)}
                  recommendText={getCoverRatioRecommendText(activeCoverRatio)}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      {/* ====== Tab 2: 详细内容 ====== */}
      <TabsContent value="content" className="pt-4">
        <Editor
          value={contentLocale === "en" ? contentEn : contentZh}
          onChange={contentLocale === "en" ? setContentEn : setContentZh}
          placeholder={t("可填写作品详细介绍、排版与链接…", "Write detailed intro, layout and links...")}
          minHeight="calc(100dvh - 156px)"
          entityType={workType === "DESIGN" ? "WORK_DESIGN" : "WORK_DEVELOPMENT"}
          entityId={id}
        />
      </TabsContent>

      {/* ====== Tab: 在线体验 (仅开发作品) ====== */}
      {workType === "DEVELOPMENT" && (
        <TabsContent value="demo" className="pt-6 max-w-2xl">
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader><CardTitle>{t("在线体验", "Live Demo")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="demoUrl">{t("体验链接", "Demo URL")}</Label>
                <Input
                  id="demoUrl"
                  placeholder="https://demo.example.com"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("填写可直接访问的在线演示地址，前台将显示“在线体验”按钮。", "Provide a public demo URL; frontend will show a \"Live Demo\" button.")}
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t("扫码体验", "QR Demo")}</Label>
                {demoQrCode ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={demoQrCode}
                      alt={t("体验二维码", "Demo QR code")}
                      className="w-20 h-20 rounded-lg border border-border object-contain bg-white"
                    />
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.createElement("input")
                          input.type = "file"
                          input.accept = "image/*"
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (!file) return
                            compressImageToDataUrl(file)
                              .then((dataUrl) => setDemoQrCode(dataUrl))
                              .catch(() => toast.error(t("图片压缩失败", "Image compression failed")))
                          }
                          input.click()
                        }}
                      >
                        {t("更换", "Replace")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDemoQrCode("")}
                      >
                        {t("移除", "Remove")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input")
                        input.type = "file"
                        input.accept = "image/*"
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (!file) return
                          compressImageToDataUrl(file)
                            .then((dataUrl) => setDemoQrCode(dataUrl))
                            .catch(() => toast.error(t("图片压缩失败", "Image compression failed")))
                        }
                        input.click()
                      }}
                    >
                      <i className="ri-qr-code-line mr-1.5" />
                      {t("上传二维码", "Upload QR")}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {t("支持微信小程序码、App 下载码等，前台将以悬浮预览展示。", "Supports mini-program/app download QR; frontend displays hover preview.")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {/* ====== Tab 3: 定价 & 版本 (仅设计作品) ====== */}
      {workType === "DESIGN" && (
        <TabsContent value="versions" className="pt-6">
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* 左侧：当前定价（展示） */}
            <div>
              <Card className="rounded-2xl border-primary/20 bg-background backdrop-blur-sm">
                <CardHeader><CardTitle>{t("当前定价", "Current Pricing")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="free">{t("开源作品", "Open Source")}</Label>
                    <Switch id="free" checked={isFree} onCheckedChange={setIsFree} />
                  </div>
                  <div>
                    <p className="font-serif text-5xl font-bold tracking-tight text-foreground">
                      <span className="text-2xl font-normal text-muted-foreground mr-1">¥</span>
                      {isFree ? "0" : (price || "—")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {isFree ? t("开源作品", "Open Source") : t("跟随最新版本价格", "Follow latest version price")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 右侧：版本管理 + 交付链接 */}
            <div className="space-y-6">
              <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    {t("版本管理", "Version Management")}
                    {currentVersion && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {t("当前", "Current")} V{currentVersion}
                      </span>
                    )}
                  </CardTitle>
                  {!showNewVersion && versions.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewVersion(true)
                        setNewVer({
                          version: suggestNextVersion(),
                          price: isFree ? "0" : (price || ""),
                          changelog: "",
                          figmaUrl: figmaUrl || "",
                          deliveryUrl: deliveryUrl || "",
                        })
                      }}
                    >
                      <i className="ri-add-line mr-1" />
                      {t("发布新版本", "Publish New Version")}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 -mt-1">
                    <i className="ri-information-line text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("每个版本需包含至少一个交付链接（Figma 或自定义链接），否则前台将显示“仅供预览”。", "Each version should include at least one delivery link (Figma/custom), otherwise frontend shows preview-only.")}
                    </p>
                  </div>
                  {(showNewVersion || versions.length === 0) && (
                    <div className="space-y-3 p-4 rounded-xl border border-border/50">
                      <p className="text-sm font-medium text-foreground">
                        {versions.length === 0 ? t("创建首个版本", "Create First Version") : t("发布新版本", "Publish New Version")}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("版本号", "Version")} *</Label>
                          <Input
                            placeholder={t("如 2.0", "e.g. 2.0")}
                            value={newVer.version}
                            onChange={(e) => setNewVer((p) => ({ ...p, version: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("版本价格（元）", "Version Price (CNY)")}{!isFree && " *"}</Label>
                          <Input
                            type="number"
                            placeholder={isFree ? t("开源", "Open Source") : t("如 199", "e.g. 199")}
                            value={isFree ? "0" : newVer.price}
                            disabled={isFree}
                            onChange={(e) => setNewVer((p) => ({ ...p, price: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("Figma 链接", "Figma URL")}</Label>
                        <Input
                          placeholder="https://www.figma.com/..."
                          value={newVer.figmaUrl}
                          onChange={(e) => setNewVer((p) => ({ ...p, figmaUrl: e.target.value }))}
                        />
                        {versions.length > 0 && (
                          <p className="text-[11px] text-muted-foreground/70">{t("留空将继承上一版本", "Leave blank to inherit previous version")}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("自定义链接", "Custom URL")}</Label>
                        <Input
                          placeholder={t("GitHub、网盘、飞书链接等", "GitHub / cloud drive / Feishu links")}
                          value={newVer.deliveryUrl}
                          onChange={(e) => setNewVer((p) => ({ ...p, deliveryUrl: e.target.value }))}
                        />
                        {versions.length > 0 && (
                          <p className="text-[11px] text-muted-foreground/70">{t("留空将继承上一版本", "Leave blank to inherit previous version")}</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t("更新说明", "Changelog")}</Label>
                        <MiniEditor
                          value={newVer.changelog}
                          onChange={(html) => setNewVer((p) => ({ ...p, changelog: html }))}
                          placeholder={t("描述本版本的更新内容…", "Describe changes in this version...")}
                          minHeight="min-h-[80px]"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button type="button" size="sm" disabled={publishingVersion || (!newVer.figmaUrl.trim() && !newVer.deliveryUrl.trim())} onClick={handlePublishVersion}>
                          {publishingVersion ? t("保存中…", "Saving…") : t("保存版本", "Save Version")}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewVersion(false)}>
                          {t("取消", "Cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {versions.length > 0 ? (
                    <div className="space-y-2">
                      {versions.map((v) => (
                        <div key={v.id} className="rounded-lg bg-accent/30 border border-border/30 overflow-hidden">
                          {editingVersionId === v.id ? (
                            <div className="p-3 space-y-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">V{v.version}</span>
                                <span className="text-xs text-muted-foreground">{t("编辑中", "Editing")}</span>
                              </div>
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">{t("版本价格（元）", "Version Price (CNY)")}</Label>
                                  <Input type="number" placeholder={t("如 199", "e.g. 199")} value={isFree ? "0" : editVer.price} disabled={isFree} onChange={(e) => setEditVer((p) => ({ ...p, price: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">{t("Figma 链接", "Figma URL")}</Label>
                                  <Input placeholder="https://www.figma.com/..." value={editVer.figmaUrl} onChange={(e) => setEditVer((p) => ({ ...p, figmaUrl: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">{t("自定义链接", "Custom URL")}</Label>
                                  <Input placeholder={t("GitHub、网盘、飞书链接等", "GitHub / cloud drive / Feishu links")} value={editVer.deliveryUrl} onChange={(e) => setEditVer((p) => ({ ...p, deliveryUrl: e.target.value }))} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">{t("更新说明", "Changelog")}</Label>
                                <MiniEditor value={editVer.changelog} onChange={(html) => setEditVer((p) => ({ ...p, changelog: html }))} placeholder={t("描述本版本的更新内容…", "Describe changes in this version...")} minHeight="min-h-[80px]" />
                              </div>
                              <div className="flex items-center gap-2">
                                <Button type="button" size="sm" disabled={savingVersion || (!editVer.figmaUrl.trim() && !editVer.deliveryUrl.trim())} onClick={() => handleUpdateVersion(v.id)}>
                                  {savingVersion ? t("保存中…", "Saving…") : t("保存", "Save")}
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingVersionId(null)}>{t("取消", "Cancel")}</Button>
                              </div>
                            </div>
                          ) : confirmDeleteId === v.id ? (
                            <div className="p-3 space-y-3">
                              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <i className="ri-error-warning-line text-destructive" />
                                <p className="text-sm text-destructive">{t(`确定删除版本 V${v.version} 吗？此操作不可撤销。`, `Delete version V${v.version}? This action cannot be undone.`)}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button type="button" variant="destructive" size="sm" disabled={deletingVersionId === v.id} onClick={() => handleDeleteVersion(v.id)}>
                                  {deletingVersionId === v.id ? t("删除中…", "Deleting…") : t("确认删除", "Confirm Delete")}
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>{t("取消", "Cancel")}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3 p-3">
                              <div className="flex-shrink-0 mt-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">V{v.version}</span>
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <span className="font-medium">¥{v.price}</span>
                                  {deliveryRedacted ? (
                                    <span className="text-xs text-muted-foreground">{t("无权限查看交付链接", "No permission to view delivery links")}</span>
                                  ) : (
                                    <>
                                      {v.figmaUrl && (
                                        <button type="button" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title={`${t("复制", "Copy")}: ${v.figmaUrl}`} onClick={() => { navigator.clipboard.writeText(v.figmaUrl!); toast.success(t("Figma 链接已复制", "Figma URL copied")) }}>
                                          <i className="ri-figma-line" />Figma<i className="ri-file-copy-line text-[10px] opacity-60" />
                                        </button>
                                      )}
                                      {v.deliveryUrl && (
                                        <button type="button" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title={`${t("复制", "Copy")}: ${v.deliveryUrl}`} onClick={() => { navigator.clipboard.writeText(v.deliveryUrl!); toast.success(t("自定义链接已复制", "Custom URL copied")) }}>
                                          <i className="ri-links-line" />{t("自定义", "Custom")}<i className="ri-file-copy-line text-[10px] opacity-60" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                                {v.changelog && (
                                  <div
                                    className="text-xs text-muted-foreground line-clamp-2 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0"
                                    dangerouslySetInnerHTML={{ __html: v.changelog }}
                                  />
                                )}
                                <p className="text-xs text-muted-foreground/60">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</p>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title={t("编辑", "Edit")} onClick={() => startEditVersion(v)}>
                                  <i className="ri-pencil-line text-sm" />
                                </Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title={t("删除", "Delete")} onClick={() => setConfirmDeleteId(v.id)}>
                                  <i className="ri-delete-bin-line text-sm" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">{t("交付链接", "Delivery Links")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {deliveryRedacted ? (
                    <p className="text-sm text-muted-foreground py-2">{t("无权限查看交付链接", "No permission to view delivery links")}</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-muted-foreground"><i className="ri-figma-line text-base" />{t("Figma 链接", "Figma URL")}</Label>
                        <Input disabled value={figmaUrl} placeholder={t("根据最新版本自动继承", "Inherited from latest version")} />
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5 text-muted-foreground"><i className="ri-links-line text-base" />{t("自定义链接", "Custom URL")}</Label>
                        <Input disabled value={deliveryUrl} placeholder={t("根据最新版本自动继承", "Inherited from latest version")} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      )}
    </Tabs>
  )
}
