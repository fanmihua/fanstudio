"use client"
/** 视频教程列表页：教程卡片网格，文案来自设置。 */
import { CardDescriptionHtml } from "@/components/frontend/CardDescriptionHtml"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { FadeContent, GlowBorder } from "@/components/react-bits"
import { CoverImage } from "@/components/frontend/CoverImage"
import { LikeButton } from "@/components/frontend/LikeButton"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy, defaultSiteName, resolveFrontendSectionVisibility } from "@/lib/page-copy"
import { useNavConfig } from "@/hooks/useNavConfig"
import { coverRatioToCss } from "@/lib/cover-ratio"
import { getDictionary } from "@/locales"
import { t } from "@/lib/i18n"
import { withLocalePath } from "@/lib/i18n-path"
import { ContentFilterGroup, SelectableMetaPill } from "@/components/frontend/ContentFilters"

type Tutorial = {
  id: string
  title: string
  slug: string
  description: string | null
  videoUrl: string
  thumbnail: string | null
  sortOrder: number
  category?: { id?: string; name: string } | null
  tags?: { id: string; name: string }[]
  likeCount?: number
}

function isBilibili(url: string): boolean {
  return /bilibili\.com|b23\.tv/i.test(url)
}

function isYoutube(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url)
}

function getEmbedUrl(url: string): string | null {
  if (isBilibili(url)) {
    const bvMatch = url.match(/bv([a-zA-Z0-9]+)/i)
    if (bvMatch) {
      return `https://player.bilibili.com/player.html?bvid=BV${bvMatch[1]}`
    }
    const aidMatch = url.match(/av(\d+)/i)
    if (aidMatch) {
      return `https://player.bilibili.com/player.html?aid=${aidMatch[1]}`
    }
  }
  if (isYoutube(url)) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`
    }
  }
  return null
}


function TutorialExpandCard({
  item,
  embedUrl,
  moduleCoverRatio,
  activeCategory,
  activeTag,
  onSelectCategory,
  onSelectTag,
}: {
  item: Tutorial
  embedUrl: string
  moduleCoverRatio: string | undefined
  activeCategory: string
  activeTag: string
  onSelectCategory: (category: string) => void
  onSelectTag: (tagId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <button type="button" className="block w-full text-left transition-transform duration-300 hover:scale-[1.1]" onClick={() => setExpanded(!expanded)}>
        <GlowBorder className="group rounded-xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm flex flex-col">
          <div
            className="overflow-hidden bg-muted relative shrink-0"
            style={{ aspectRatio: coverRatioToCss(moduleCoverRatio) }}
          >
            <CoverImage src={item.thumbnail} alt={item.title} fallbackIcon="ri-video-line" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
              <i className={`${expanded ? "ri-close-circle-fill" : "ri-play-circle-fill"} text-4xl text-white/90`} />
            </div>
            <LikeButton entityType="tutorial" entityId={item.id} initialCount={item.likeCount} overlay className="absolute bottom-2 right-2 z-20" />
          </div>
          <div className="p-4">
            <h3 className="text-base font-medium text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">
              {item.title}
            </h3>
            {item.description && (
              <CardDescriptionHtml html={item.description} className="mt-1.5" />
            )}
            {(item.category?.name || (item.tags && item.tags.length > 0)) && (
              <div className="flex flex-nowrap items-center gap-1.5 mt-2 overflow-hidden">
                {item.category?.name && (
                  <SelectableMetaPill
                    label={item.category.name}
                    tone="category"
                    active={activeCategory === (item.category.id ?? item.category.name)}
                    className="max-w-[5rem] truncate"
                    onSelect={() => {
                      const categoryId = item.category?.id ?? item.category?.name ?? ""
                      onSelectCategory(activeCategory === categoryId ? "" : categoryId)
                    }}
                  />
                )}
                {(item.tags ?? []).slice(0, 2).map((tag) => (
                  <SelectableMetaPill
                    key={tag.id}
                    label={tag.name}
                    active={activeTag === tag.id}
                    className="hidden sm:inline-flex max-w-[5rem] truncate"
                    onSelect={() => onSelectTag(activeTag === tag.id ? "" : tag.id)}
                  />
                ))}
                {(item.tags?.length ?? 0) > 2 && (
                  <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0">+{(item.tags?.length ?? 0) - 2}</span>
                )}
              </div>
            )}
          </div>
        </GlowBorder>
      </button>
      {expanded && (
        <div className="mt-2 rounded-xl overflow-hidden border border-border bg-muted">
          <iframe
            src={embedUrl}
            title={item.title}
            className="w-full aspect-video"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      )}
    </div>
  )
}

export default function TutorialsPage() {
  const router = useRouter()
  const { nav, pageCopy, siteName, locale } = useNavConfig()
  const dict = getDictionary(locale)
  const sectionVisibility = resolveFrontendSectionVisibility(pageCopy)
  const sectionLabel = nav.tutorials ?? defaultNav.tutorials ?? ""
  const sectionDesc = pageCopy.tutorialsDesc ?? defaultPageCopy.tutorialsDesc ?? ""
  const moduleCoverRatio = pageCopy.coverRatioTutorials
  const [list, setList] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("")
  const [activeTag, setActiveTag] = useState("")

  useEffect(() => {
    fetch(`/api/tutorials?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [locale])

  useEffect(() => {
    if (!sectionVisibility.tutorials) {
      router.replace(withLocalePath("/", locale))
    }
  }, [locale, router, sectionVisibility.tutorials])

  if (!sectionVisibility.tutorials) return null

  const categories = Array.from(
    new Map(
      list
        .filter((item) => item.category?.name)
        .map((item) => [item.category?.id ?? item.category?.name ?? "", { id: item.category?.id ?? item.category?.name ?? "", label: item.category?.name ?? "" }]),
    ).values(),
  )
  const tags = Array.from(
    new Map(list.flatMap((item) => item.tags ?? []).map((tag) => [tag.id, { id: tag.id, label: tag.name }])).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, locale === "zh" ? "zh-CN" : "en"))
  const filteredList = list.filter((item) => {
    const matchesCategory = !activeCategory || (item.category?.id ?? item.category?.name) === activeCategory
    const matchesTag = !activeTag || item.tags?.some((tag) => tag.id === activeTag)
    return matchesCategory && matchesTag
  })

  return (
    <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
      <FadeContent>
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-10">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1 min-w-0 max-w-[40vw] sm:max-w-none truncate">
            <i className="ri-home-4-line shrink-0" /> <span className="truncate">{siteName || defaultSiteName}</span>
          </Link>
          <i className="ri-arrow-right-s-line text-muted-foreground/60 shrink-0" />
          <span className="text-foreground shrink-0">{sectionLabel}</span>
        </nav>
      </FadeContent>

      <FadeContent delay={0.1}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-12">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-3">
              {sectionLabel}
            </h1>
            <p className="text-muted-foreground text-lg">
              {sectionDesc}
            </p>
          </div>
          {(categories.length > 0 || tags.length > 0) && (
            <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:max-w-[58%] md:justify-end">
              <ContentFilterGroup
                label={locale === "en" ? "Category" : "分类"}
                allLabel={t(dict, "frontend.category_all", "全部")}
                options={categories}
                value={activeCategory}
                onChange={setActiveCategory}
              />
              <ContentFilterGroup
                label={locale === "en" ? "Tags" : "标签"}
                allLabel={t(dict, "frontend.category_all", "全部")}
                options={tags}
                value={activeTag}
                onChange={setActiveTag}
              />
            </div>
          )}
        </div>
      </FadeContent>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="aspect-[3/4] bg-muted relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-muted-foreground/10" />
                </div>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-muted-foreground py-12">{t(dict, "common.empty_prefix", "暂无")}{sectionLabel}</div>
      ) : (
        <>
          {/* 瀑布流卡片列表 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredList.map((item, index) => {
              const embedUrl = getEmbedUrl(item.videoUrl)
              return (
                <FadeContent key={item.id} delay={0.1 + index * 0.05} className="h-full">
                  <section id={item.slug} className="scroll-mt-8 h-full">
                    {embedUrl ? (
                      /* 可嵌入的视频 - 点击展开 */
                      <TutorialExpandCard
                        item={item}
                        embedUrl={embedUrl}
                        moduleCoverRatio={moduleCoverRatio}
                        activeCategory={activeCategory}
                        activeTag={activeTag}
                        onSelectCategory={setActiveCategory}
                        onSelectTag={setActiveTag}
                      />
                    ) : (
                      /* 外部链接 - 跳转 */
                      <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="block h-full transition-transform duration-300 hover:scale-[1.03]">
                        <GlowBorder className="group h-full rounded-xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm flex flex-col">
                          <div
                            className="overflow-hidden bg-muted relative shrink-0"
                            style={{ aspectRatio: coverRatioToCss(moduleCoverRatio) }}
                          >
                            <CoverImage src={item.thumbnail} alt={item.title} fallbackIcon="ri-video-line" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                              <i className="ri-play-circle-fill text-4xl text-white/90" />
                            </div>
                            <LikeButton entityType="tutorial" entityId={item.id} initialCount={item.likeCount} overlay className="absolute bottom-2 right-2 z-20" />
                          </div>
                          <div className="p-4">
                            <h3 className="text-base font-medium text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">
                              {item.title}
                            </h3>
                            {item.description && (
                              <CardDescriptionHtml html={item.description} className="mt-1.5" />
                            )}
                            {(item.category?.name || (item.tags && item.tags.length > 0)) && (
                              <div className="flex flex-nowrap items-center gap-1.5 mt-2 overflow-hidden">
                                {item.category?.name && (
                                  <SelectableMetaPill
                                    label={item.category.name}
                                    tone="category"
                                    active={activeCategory === (item.category.id ?? item.category.name)}
                                    className="max-w-[5rem] truncate"
                                    onSelect={() => {
                                      const categoryId = item.category?.id ?? item.category?.name ?? ""
                                      setActiveCategory(activeCategory === categoryId ? "" : categoryId)
                                    }}
                                  />
                                )}
                                {(item.tags ?? []).slice(0, 2).map((tag) => (
                                  <SelectableMetaPill
                                    key={tag.id}
                                    label={tag.name}
                                    active={activeTag === tag.id}
                                    className="hidden sm:inline-flex max-w-[5rem] truncate"
                                    onSelect={() => setActiveTag(activeTag === tag.id ? "" : tag.id)}
                                  />
                                ))}
                                {(item.tags?.length ?? 0) > 2 && (
                                  <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0">+{(item.tags?.length ?? 0) - 2}</span>
                                )}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-2">
                              <i className="ri-external-link-line" /> {t(dict, "frontend.go_watch", "前往观看")}
                            </span>
                          </div>
                        </GlowBorder>
                      </a>
                    )}
                  </section>
                </FadeContent>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
