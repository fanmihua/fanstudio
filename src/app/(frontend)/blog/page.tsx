"use client"
/** 博客列表页：文章卡片网格，支持分类/标签筛选，文案来自设置。 */
import { CardDescriptionHtml } from "@/components/frontend/CardDescriptionHtml"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy, defaultSiteName, resolveFrontendSectionVisibility } from "@/lib/page-copy"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { FadeContent, GlowBorder } from "@/components/react-bits"
import { CoverImage } from "@/components/frontend/CoverImage"
import { LikeButton } from "@/components/frontend/LikeButton"
import { useNavConfig } from "@/hooks/useNavConfig"
import { coverRatioToCss } from "@/lib/cover-ratio"
import { getDictionary } from "@/locales"
import { t } from "@/lib/i18n"
import { withLocalePath } from "@/lib/i18n-path"
import { ContentFilterGroup, SelectableMetaPill } from "@/components/frontend/ContentFilters"

type Post = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  createdAt: string
  category?: { id?: string; name: string } | null
  tags?: { id: string; name: string }[]
  likeCount?: number
}

export default function BlogPage() {
  const router = useRouter()
  const { nav, pageCopy, siteName, locale } = useNavConfig()
  const dict = getDictionary(locale)
  const sectionVisibility = resolveFrontendSectionVisibility(pageCopy)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("")
  const [activeTag, setActiveTag] = useState("")
  const sectionLabel = nav.blog ?? defaultNav.blog ?? ""
  const sectionDesc = pageCopy.blogDesc ?? defaultPageCopy.blogDesc ?? ""
  const moduleCoverRatio = pageCopy.coverRatioBlog

  useEffect(() => {
    fetch(`/api/posts?locale=${locale}`)
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [locale])

  useEffect(() => {
    if (!sectionVisibility.blog) {
      router.replace(withLocalePath("/", locale))
    }
  }, [locale, router, sectionVisibility.blog])

  if (!sectionVisibility.blog) return null

  const categories = Array.from(
    new Map(
      posts
        .filter((post) => post.category?.name)
        .map((post) => [post.category?.id ?? post.category?.name ?? "", { id: post.category?.id ?? post.category?.name ?? "", label: post.category?.name ?? "" }]),
    ).values(),
  )
  const tags = Array.from(
    new Map(posts.flatMap((post) => post.tags ?? []).map((tag) => [tag.id, { id: tag.id, label: tag.name }])).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, locale === "zh" ? "zh-CN" : "en"))
  const filteredPosts = posts.filter((post) => {
    const matchesCategory = !activeCategory || (post.category?.id ?? post.category?.name) === activeCategory
    const matchesTag = !activeTag || post.tags?.some((tag) => tag.id === activeTag)
    return matchesCategory && matchesTag
  })

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

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
                <div className="h-3 w-1/3 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-muted-foreground py-12">{t(dict, "common.empty_prefix", "暂无")}{sectionLabel}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredPosts.map((post, index) => (
            <FadeContent key={post.id} delay={0.1 + index * 0.05} className="h-full">
              <Link href={`/blog/${post.slug}`} className="block h-full transition-transform duration-300 hover:scale-[1.03]">
                <GlowBorder className="group h-full rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">
                  <div
                    className="overflow-hidden bg-muted shrink-0 relative"
                    style={{ aspectRatio: coverRatioToCss(moduleCoverRatio) }}
                  >
                    <CoverImage src={post.coverImage} alt={post.title} fallbackIcon="ri-article-line" />
                    <LikeButton entityType="post" entityId={post.id} initialCount={post.likeCount} overlay className="absolute bottom-2 right-2 z-10" />
                  </div>
                  <div className="p-4">
                    <h2 className="text-base font-semibold text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <CardDescriptionHtml html={post.excerpt} className="mt-1.5" />
                    )}
                    <div className="flex items-center gap-2 mt-2 min-w-0">
                      <time className="text-xs font-mono text-muted-foreground/60 shrink-0">
                        {formatDate(post.createdAt)}
                      </time>
                      {(post.category?.name || (post.tags && post.tags.length > 0)) && (
                        <div className="flex flex-nowrap items-center gap-1.5 min-w-0 overflow-hidden">
                          {post.category?.name && (
                            <SelectableMetaPill
                              label={post.category.name}
                              tone="category"
                              active={activeCategory === (post.category.id ?? post.category.name)}
                              className="max-w-[5rem] truncate"
                              onSelect={() => {
                                const categoryId = post.category?.id ?? post.category?.name ?? ""
                                setActiveCategory(activeCategory === categoryId ? "" : categoryId)
                              }}
                            />
                          )}
                          {(post.tags ?? []).slice(0, 2).map((tag) => (
                            <SelectableMetaPill
                              key={tag.id}
                              label={tag.name}
                              active={activeTag === tag.id}
                              className="hidden sm:inline-flex max-w-[5rem] truncate"
                              onSelect={() => setActiveTag(activeTag === tag.id ? "" : tag.id)}
                            />
                          ))}
                          {(post.tags?.length ?? 0) > 2 && (
                            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0">+{(post.tags?.length ?? 0) - 2}</span>
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
