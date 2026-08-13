"use client"
/** 教程编辑页：标题、封面、分类/标签、视频链接、简介。 */
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CoverImageUpload } from "@/components/admin/CoverImageUpload"
import { MiniEditor } from "@/components/admin/MiniEditor"
import { CategoryCombobox } from "@/components/admin/CategoryCombobox"
import { TagCombobox } from "@/components/admin/TagCombobox"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
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
    || `tutorial-${Date.now()}`
}

export default function EditTutorialPage() {
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
  const [videoUrl, setVideoUrl] = useState("")
  const [thumbnail, setThumbnail] = useState("")
  const [moduleCoverRatio, setModuleCoverRatio] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const [categoryId, setCategoryId] = useState("")
  const [tagIds, setTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [originalSlug, setOriginalSlug] = useState("")
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!id || fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/tutorials/${id}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Not found")
        return r.json()
      })
      .then((item) => {
        setTitle(item.title ?? "")
        setTitleEn(item.titleI18n?.en ?? "")
        setSlug(item.slug ?? "")
        setSlugEn(item.slugI18n?.en ?? "")
        setOriginalSlug(item.slug ?? "")
        setDescription(item.description ?? "")
        setDescriptionEn(item.descriptionI18n?.en ?? "")
        setVideoUrl(item.videoUrl ?? "")
        setThumbnail(item.thumbnail ?? "")
        setCategoryId(item.categoryId ?? "")
        setTagIds(Array.isArray(item.tags) ? item.tags.map((t: { id: string }) => t.id) : [])
      })
      .catch(() => router.push("/admin/tutorials"))
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
        setModuleCoverRatio(normalizeCoverRatio(copy.coverRatioTutorials))
      })
      .catch(() => {})
  }, [])

  async function handleSave() {
    if (!title.trim() || !slug.trim() || !videoUrl.trim()) {
      toast.error(t("请填写标题、slug 和视频链接", "Please fill title, slug and video URL"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/tutorials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          videoUrl: videoUrl.trim(),
          thumbnail: thumbnail.trim() || null,
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
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || t("保存失败", "Save failed"))
        return
      }
      router.push("/admin/tutorials")
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
    <div className="space-y-0">
      {/* 吸顶头部 */}
      <div className="sticky top-0 z-10 -mx-6 md:-mx-8 lg:-mx-12 -mt-8 px-6 md:px-8 lg:px-12 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center justify-between py-3">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {t("编辑视频教程", "Edit Tutorial")}
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
              <Link href="/admin/tutorials">{t("取消", "Cancel")}</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("保存中…", "Saving…") : t("保存", "Save")}
            </Button>
          </div>
        </div>
      </div>

      {/* 两列布局 */}
      <div className="grid gap-6 lg:grid-cols-3 pt-6">
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
                      if (/^tutorial-\d+$/.test(slugEn) && newTitle.trim()) {
                        setSlugEn(titleToSlug(newTitle))
                      }
                    } else {
                      setTitle(newTitle)
                      if (/^tutorial-\d+$/.test(slug) && newTitle.trim()) {
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
                  placeholder={t("如 figma-auto-layout", "e.g. figma-auto-layout")}
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
                    <> · {t("前台地址：", "Public URL: ")}<span className="font-mono text-foreground/70">/tutorials/{contentLocale === "en" ? slugEn : slug}</span></>
                  )}
                </p>
                {slug !== originalSlug && originalSlug && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <i className="ri-alert-line text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t("修改已发布教程的 URL 别名会导致旧链接失效，请谨慎操作。", "Changing the slug of a published tutorial may break old links.")}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="videoUrl">{t("视频链接", "Video URL")}</Label>
                <Input
                  id="videoUrl"
                  placeholder={t("填写视频链接（B站、YouTube 等平台链接）", "Paste video link (Bilibili/YouTube/etc.)")}
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("支持 Bilibili、YouTube 链接自动嵌入播放，其他链接将显示跳转按钮。", "Bilibili and YouTube links can be embedded automatically.")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("简介", "Summary")}</Label>
                <MiniEditor
                  value={contentLocale === "en" ? descriptionEn : description}
                  onChange={contentLocale === "en" ? setDescriptionEn : setDescription}
                  placeholder={t("视频教程的简要介绍...", "A short summary of this tutorial...")}
                  minHeight="min-h-[100px]"
                />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("分类", "Category")}</Label>
                  <CategoryCombobox
                    type="TUTORIAL"
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
                value={thumbnail}
                onChange={setThumbnail}
                entityType="TUTORIAL"
                entityId={id}
                aspectRatio={coverRatioToCss(moduleCoverRatio)}
                recommendText={getCoverRatioRecommendText(moduleCoverRatio)}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
