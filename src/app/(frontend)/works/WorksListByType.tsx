"use client"
/** 设计/开发作品列表组件：按 type 拉取作品并展示卡片网格，文案来自 nav/pageCopy。 */
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { FadeContent, GlowBorder } from "@/components/react-bits"
import { CoverImage } from "@/components/frontend/CoverImage"
import { CardDescriptionHtml } from "@/components/frontend/CardDescriptionHtml"
import { LikeButton } from "@/components/frontend/LikeButton"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy, defaultSiteName, resolveFrontendSectionVisibility } from "@/lib/page-copy"
import { useNavConfig } from "@/hooks/useNavConfig"
import { coverRatioToCss } from "@/lib/cover-ratio"
import { getDictionary } from "@/locales"
import { t } from "@/lib/i18n"
import { withLocalePath } from "@/lib/i18n-path"
import { ContentFilterGroup, SelectableMetaPill } from "@/components/frontend/ContentFilters"

type Work = {
  id: string
  title: string
  slug: string
  description: string | null
  coverImage: string
  price: number | null
  isFree: boolean
  category?: { id?: string; name: string } | null
  tags?: { id: string; name: string }[]
  createdAt: string
  likeCount?: number
  downloadCount?: number
}

type WorksListByTypeProps = {
  type: "design" | "development"
  navKey: "worksDesign" | "worksDev"
  descKey: "worksDesignDesc" | "worksDevDesc"
}

export function WorksListByType({
  type,
  navKey,
  descKey,
}: WorksListByTypeProps) {
  const router = useRouter()
  const { nav, pageCopy, siteName, locale } = useNavConfig()
  const dict = getDictionary(locale)
  const sectionVisibility = resolveFrontendSectionVisibility(pageCopy)
  const isVisible = type === "design" ? sectionVisibility.worksDesign : sectionVisibility.worksDev
  const sectionLabel = nav[navKey] ?? (type === "design" ? (defaultNav.worksDesign ?? "") : (defaultNav.worksDev ?? ""))
  const sectionDesc =
    pageCopy[descKey] ??
    (type === "design" ? (defaultPageCopy.worksDesignDesc ?? "") : (defaultPageCopy.worksDevDesc ?? ""))
  const moduleCoverRatio =
    type === "design"
      ? pageCopy.coverRatioWorksDesign
      : pageCopy.coverRatioWorksDev
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("")
  const [activeTag, setActiveTag] = useState("")
  const fallbackIcon = type === "design" ? "ri-palette-line" : "ri-code-s-slash-line"

  useEffect(() => {
    fetch(`/api/works?type=${type}&locale=${locale}`)
      .then((r) => r.json())
      .then((data) => setWorks(Array.isArray(data) ? data : []))
      .catch(() => setWorks([]))
      .finally(() => setLoading(false))
  }, [locale, type])

  useEffect(() => {
    if (!isVisible) {
      router.replace(withLocalePath("/", locale))
    }
  }, [isVisible, locale, router])

  if (!isVisible) return null

  const categories = Array.from(
    new Map(
      works
        .filter((work) => work.category?.name)
        .map((work) => [work.category?.id ?? work.category?.name ?? "", { id: work.category?.id ?? work.category?.name ?? "", label: work.category?.name ?? "" }]),
    ).values(),
  )
  const tags = Array.from(
    new Map(works.flatMap((work) => work.tags ?? []).map((tag) => [tag.id, { id: tag.id, label: tag.name }])).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, locale === "zh" ? "zh-CN" : "en"))
  const filteredWorks = works.filter((work) => {
    const matchesCategory = !activeCategory || (work.category?.id ?? work.category?.name) === activeCategory
    const matchesTag = !activeTag || work.tags?.some((tag) => tag.id === activeTag)
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
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="aspect-[3/4] bg-muted" />
              <div className="p-4 space-y-2.5">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-5 w-10 bg-muted rounded mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredWorks.length === 0 ? (
        <div className="text-muted-foreground py-12">{t(dict, "common.empty_prefix", "暂无")}{sectionLabel}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredWorks.map((work, index) => (
            <FadeContent key={work.id} delay={0.1 + index * 0.05} className="h-full">
              <Link href={withLocalePath(`/works/${work.slug}`, locale)} className="block h-full transition-transform duration-300 hover:scale-[1.03]">
                <GlowBorder className="group h-full rounded-xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm flex flex-col">
                  <div
                    className="overflow-hidden bg-muted shrink-0 relative"
                    style={{ aspectRatio: coverRatioToCss(moduleCoverRatio) }}
                  >
                    <CoverImage src={work.coverImage} alt={work.title} fallbackIcon={fallbackIcon} />
                    {work.isFree && (
                      <span className="absolute top-2 left-2 z-10 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-500/90 text-white backdrop-blur-sm">
                        {t(dict, "frontend.open_source", "开源")}
                      </span>
                    )}
                    <LikeButton entityType="work" entityId={work.id} initialCount={work.likeCount} overlay className="absolute bottom-2 right-2 z-10" />
                  </div>
                  <div className="p-4 flex flex-col">
                    <h3 className="text-base font-semibold text-foreground truncate group-hover:text-foreground/80 transition-colors">
                      {work.title}
                    </h3>
                    {work.description && (
                      <CardDescriptionHtml html={work.description} className="mt-1" />
                    )}
                    <div className="pt-3 mt-auto flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {work.category?.name && (
                          <SelectableMetaPill
                            label={work.category.name}
                            tone="category"
                            active={activeCategory === (work.category.id ?? work.category.name)}
                            className="whitespace-nowrap"
                            onSelect={() => {
                              const categoryId = work.category?.id ?? work.category?.name ?? ""
                              setActiveCategory(activeCategory === categoryId ? "" : categoryId)
                            }}
                          />
                        )}
                        {(work.tags ?? []).slice(0, 2).map((tag) => (
                          <SelectableMetaPill
                            key={tag.id}
                            label={tag.name}
                            active={activeTag === tag.id}
                            className="hidden sm:inline-flex whitespace-nowrap"
                            onSelect={() => setActiveTag(activeTag === tag.id ? "" : tag.id)}
                          />
                        ))}
                        {(work.tags?.length ?? 0) > 2 && (
                          <span className="hidden sm:inline text-[10px] leading-tight px-1.5 py-0.5 rounded content-meta-pill-muted whitespace-nowrap">+{(work.tags?.length ?? 0) - 2}</span>
                        )}
                      </div>
                      {(type === "design" || (work.downloadCount ?? 0) > 0) && (
                        <div className="flex items-center justify-between gap-2">
                          {type === "design" ? (
                            <span className="font-serif text-xl font-bold tracking-tight text-foreground leading-none">
                              <span className="text-xs font-normal text-muted-foreground mr-0.5">¥</span>{work.isFree ? 0 : (work.price ?? 0)}
                            </span>
                          ) : (
                            <span />
                          )}
                          {(work.downloadCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-label={t(dict, "frontend.downloads", "下载量")}>
                              <i className="ri-download-2-line" />
                              <span className="tabular-nums">{work.downloadCount}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </GlowBorder>
              </Link>
            </FadeContent>
          ))}
        </div>
      )}
    </div>
  )
}
