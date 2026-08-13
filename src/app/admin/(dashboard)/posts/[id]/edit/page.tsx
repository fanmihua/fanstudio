"use client"
/** 文章编辑页：标题、摘要、封面、分类/标签、正文（BlockNote）。 */
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import type { Block } from "@blocknote/core"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Editor } from "@/components/admin/DynamicBlockNoteEditor"
import { CoverImageUpload } from "@/components/admin/CoverImageUpload"
import { MiniEditor } from "@/components/admin/MiniEditor"
import { CategoryCombobox } from "@/components/admin/CategoryCombobox"
import { TagCombobox } from "@/components/admin/TagCombobox"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import { getInitialContentForEditor } from "@/lib/content-format"
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
    || `post-${Date.now()}`
}

export default function EditPostPage() {
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
  const [contentZh, setContentZh] = useState<Block[] | null>(null)
  const [contentEn, setContentEn] = useState<Block[] | null>(null)
  const [excerpt, setExcerpt] = useState("")
  const [excerptEn, setExcerptEn] = useState("")
  const [coverImage, setCoverImage] = useState("")
  const [moduleCoverRatio, setModuleCoverRatio] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const [categoryId, setCategoryId] = useState("")
  const [tagIds, setTagIds] = useState<string[]>([])
  const [ctaProductId, setCtaProductId] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")
  const [products, setProducts] = useState<{ id: string; name: string; enabled: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT")
  const [originalSlug, setOriginalSlug] = useState("")
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!id || fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/posts/${id}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((post) => {
        setTitle(post.title ?? "")
        setTitleEn(post.titleI18n?.en ?? "")
        setSlug(post.slug ?? "")
        setSlugEn(post.slugI18n?.en ?? "")
        setOriginalSlug(post.slug ?? "")
        setContentZh(getInitialContentForEditor(post.contentI18n?.zh ?? post.content))
        setContentEn(getInitialContentForEditor(post.contentI18n?.en ?? null))
        setExcerpt(post.excerpt ?? "")
        setExcerptEn(post.excerptI18n?.en ?? "")
        setCoverImage(post.coverImage ?? "")
        setCategoryId(post.categoryId ?? "")
        setCtaProductId(post.ctaProductId ?? "")
        setCtaLabel(post.ctaLabel ?? "")
        setTagIds(Array.isArray(post.tags) ? post.tags.map((t: { id: string }) => t.id) : [])
        setCurrentStatus(post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT")
      })
      .catch(() => router.push("/admin/posts"))
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
        setModuleCoverRatio(normalizeCoverRatio(copy.coverRatioBlog))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/admin/membership/products", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; name: string; enabled: boolean }[]) =>
        setProducts(Array.isArray(data) ? data.filter((p) => p.enabled) : []),
      )
      .catch(() => {})
  }, [])

  async function handleSave(status: "DRAFT" | "PUBLISHED") {
    if (!title.trim() || !slug.trim()) {
      toast.error(t("请填写标题和 slug", "Please fill title and slug"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          content: contentZh ?? undefined,
          excerpt: excerpt.trim() || null,
          coverImage: coverImage.trim() || null,
          status,
          categoryId: categoryId || null,
          ctaProductId: ctaProductId || null,
          ctaLabel: ctaLabel.trim() || null,
          tagIds,
          titleI18n: {
            zh: title.trim(),
            en: titleEn.trim() || undefined,
          },
          slugI18n: {
            zh: slug.trim(),
            en: slugEn.trim() || undefined,
          },
          excerptI18n: {
            zh: excerpt.trim() || undefined,
            en: excerptEn.trim() || undefined,
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
      router.push("/admin/posts")
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
            {t("编辑文章", "Edit Post")}
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
              <Link href="/admin/posts">{t("取消", "Cancel")}</Link>
            </Button>
            <Button variant="secondary" onClick={() => handleSave("DRAFT")} disabled={saving}>
              {saving ? t("保存中…", "Saving…") : t("保存草稿", "Save Draft")}
            </Button>
            <Button onClick={() => handleSave("PUBLISHED")} disabled={saving}>
              {saving
                ? t("发布中…", "Publishing…")
                : currentStatus === "PUBLISHED"
                  ? t("更新发布", "Update Published")
                  : t("发布", "Publish")}
            </Button>
          </div>
        </div>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="basic">{t("基本信息", "Basic Info")}</TabsTrigger>
          <TabsTrigger value="content">{t("文章内容", "Content")}</TabsTrigger>
        </TabsList>
      </div>

      {/* ====== Tab 1: 基本信息 ====== */}
      <TabsContent value="basic" className="pt-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("标题", "Title")}</Label>
                  <Input
                    id="title"
                    value={contentLocale === "en" ? titleEn : title}
                    onChange={(e) => {
                      const newTitle = e.target.value
                      if (contentLocale === "en") {
                        setTitleEn(newTitle)
                        if (/^post-\d+$/.test(slugEn) && newTitle.trim()) {
                          setSlugEn(titleToSlug(newTitle))
                        }
                      } else {
                        setTitle(newTitle)
                        if (/^post-\d+$/.test(slug) && newTitle.trim()) {
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
                    placeholder={t("如 my-first-post", "e.g. my-first-post")}
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
                      <> · {t("前台地址：", "Public URL: ")}<span className="font-mono text-foreground/70">{contentLocale === "en" ? `/en/blog/${slugEn}` : `/blog/${slug}`}</span></>
                    )}
                  </p>
                  {currentStatus === "PUBLISHED" && slug !== originalSlug && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <i className="ri-alert-line text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {t("修改已发布文章的 URL 别名会导致旧链接失效，请谨慎操作。", "Changing the slug of a published post may break old links.")}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("摘要", "Summary")}</Label>
                  <MiniEditor
                    value={contentLocale === "en" ? excerptEn : excerpt}
                    onChange={contentLocale === "en" ? setExcerptEn : setExcerpt}
                    placeholder={t("文章摘要，将在列表页展示...", "Post summary shown on list page...")}
                    minHeight="min-h-[80px]"
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("分类", "Category")}</Label>
                    <CategoryCombobox
                      type="POST"
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
                <Separator />
                <div className="space-y-2">
                  <Label>{t("产品入口（文末按钮）", "Product CTA (footer button)")}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Select value={ctaProductId || "none"} onValueChange={(value) => setCtaProductId(value === "none" ? "" : value)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("不放产品入口", "None")}</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      placeholder={t("按钮文案（可选）", "Button label (optional)")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "选择产品后，文章文末会显示该产品入口；产品需先在售卖配置中填写入口路径。",
                      "Select a product to show its entry button at the end of the article. Configure the product entry path first.",
                    )}
                  </p>
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
                  entityType="POST"
                  entityId={id}
                  aspectRatio={coverRatioToCss(moduleCoverRatio)}
                  recommendText={getCoverRatioRecommendText(moduleCoverRatio)}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      {/* ====== Tab 2: 文章内容 ====== */}
      <TabsContent value="content" className="pt-4">
        <Editor
          key={contentLocale}
          value={contentLocale === "en" ? contentEn : contentZh}
          onChange={contentLocale === "en" ? setContentEn : setContentZh}
          placeholder={t("开始写作，或粘贴 Markdown / 图片 / 其他平台内容…", "Start writing, or paste Markdown / images / content…")}
          minHeight="calc(100dvh - 156px)"
          entityType="POST"
          entityId={id}
        />
      </TabsContent>
    </Tabs>
  )
}
