/** 博客文章详情页：标题、封面、正文（BlockNote/Tiptap 转 HTML）、SEO。 */
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { getBaseUrl, getPublicSiteUrl } from "@/lib/utils"
import { CardDescriptionHtml } from "@/components/frontend/CardDescriptionHtml"
import { contentToHtml, extractContentHeadings, jsonToPlainText } from "@/lib/render-content"
import { defaultNav } from "@/lib/nav-config"
import { defaultPersonalName, defaultSiteName } from "@/lib/page-copy"
import { ProseImageLightbox } from "@/components/frontend/ProseImageLightbox"
import { BackToTop } from "@/components/frontend/BackToTop"
import { PostCTA } from "@/components/frontend/PostCTA"
import { LikeButton } from "@/components/frontend/LikeButton"
import { PostShare } from "@/components/frontend/PostShare"
import { ArticleOutline } from "@/components/frontend/ArticleOutline"
import { getDictionary } from "@/locales"
import { normalizeLocale, t, type Locale } from "@/lib/i18n"
import { withLocalePath } from "@/lib/i18n-path"

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

type BlogPostViewProps = {
  slug: string
  locale?: Locale
}

function stripHtml(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function localizedSlug(raw: unknown, locale: Locale, fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback
  const value = (raw as Record<string, unknown>)[locale]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function localizedSeo(raw: unknown, locale: Locale): { title?: string; description?: string } {
  if (!raw || typeof raw !== "object") return {}
  const localeValue = (raw as Record<string, unknown>)[locale]
  if (!localeValue || typeof localeValue !== "object") return {}
  const value = localeValue as Record<string, unknown>
  const title = typeof value.title === "string" && value.title.trim() ? value.title.trim() : undefined
  const description =
    typeof value.description === "string" && value.description.trim() ? value.description.trim() : undefined
  return { title, description }
}

export async function buildBlogPostMetadata({ slug, locale }: BlogPostViewProps): Promise<Metadata> {
  const resolvedLocale = normalizeLocale(locale)
  const base = getBaseUrl()
  const response = await fetch(`${base}/api/posts?slug=${encodeURIComponent(slug)}&locale=${resolvedLocale}`, {
    cache: "no-store",
  })
  if (!response.ok) return {}

  const post = await response.json()
  const seo = localizedSeo(post.seoI18n, resolvedLocale)
  const title = seo.title ?? (typeof post.title === "string" ? post.title : "")
  const description = seo.description ?? stripHtml(post.excerpt).slice(0, 200)
  const resolvedSlug = typeof post.slug === "string" && post.slug.trim() ? post.slug.trim() : slug
  const publicSiteUrl = getPublicSiteUrl()
  const canonicalPath = withLocalePath(`/blog/${resolvedSlug}`, resolvedLocale)
  const canonicalUrl = `${publicSiteUrl}${canonicalPath}`
  const imageUrl = `${publicSiteUrl}/api/share-thumb?slug=${encodeURIComponent(resolvedSlug)}`
  const zhSlug = localizedSlug(post.slugI18n, "zh", resolvedSlug)
  const enSlug = localizedSlug(post.slugI18n, "en", resolvedSlug)

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        zh: `${publicSiteUrl}${withLocalePath(`/blog/${zhSlug}`, "zh")}`,
        en: `${publicSiteUrl}${withLocalePath(`/blog/${enSlug}`, "en")}`,
      },
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      siteName: "Fan's Studio",
      locale: resolvedLocale === "en" ? "en_US" : "zh_CN",
      publishedTime: post.publishedAt ?? post.createdAt ?? undefined,
      modifiedTime: post.updatedAt ?? undefined,
      images: [{ url: imageUrl, width: 720, height: 540, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  return buildBlogPostMetadata({ slug })
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  return renderBlogPostPage({ slug })
}

export async function renderBlogPostPage({ slug, locale }: BlogPostViewProps) {
  const resolvedLocale = normalizeLocale(locale)
  const base = getBaseUrl()
  const [postRes, settingsRes] = await Promise.all([
    fetch(`${base}/api/posts?slug=${encodeURIComponent(slug)}&locale=${resolvedLocale}`, { cache: "no-store" }),
    fetch(`${base}/api/settings?locale=${resolvedLocale}`, { cache: "no-store" }),
  ])
  if (!postRes.ok) notFound()
  const post = await postRes.json()
  const settings = settingsRes.ok ? await settingsRes.json() : {}
  const dict = getDictionary(resolvedLocale)
  const nav = { ...defaultNav, ...(settings.nav && typeof settings.nav === "object" ? settings.nav : {}) }
  const sectionLabel = nav.blog ?? defaultNav.blog
  const homeHref = withLocalePath("/", resolvedLocale)
  const blogHref = withLocalePath("/blog", resolvedLocale)

  const contentHtml = contentToHtml(post.content)
  const contentHeadings = extractContentHeadings(post.content)
  const bodyPlain = jsonToPlainText(post.content)
  const categoryName = post.category?.name ?? ""
  const dateLocale = resolvedLocale === "en" ? "en-US" : "zh-CN"
  const publishedAt = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString(dateLocale, { year: "numeric", month: "2-digit", day: "2-digit" })
    : post.createdAt
      ? new Date(post.createdAt).toLocaleDateString(dateLocale, { year: "numeric", month: "2-digit", day: "2-digit" })
      : ""

  // 从后台 Settings 获取作者信息（头像、名称、职位）
  const about = settings.about && typeof settings.about === "object" ? settings.about : {}
  const profileCard = about.profileCard && typeof about.profileCard === "object" ? about.profileCard : {}
  const authorAvatar = settings.avatar || post.author?.avatar || ""
  const authorName = profileCard.personalName || post.author?.name || defaultPersonalName
  const authorTitle = profileCard.personalTitle || ""

  return (
    <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
      <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-10">
        <Link href={homeHref} className="hover:text-foreground transition-colors flex items-center gap-1 min-w-0 max-w-[30vw] sm:max-w-none truncate">
          <i className="ri-home-4-line shrink-0" /> <span className="truncate">{settings.siteName || defaultSiteName}</span>
        </Link>
        <i className="ri-arrow-right-s-line text-muted-foreground/60 shrink-0" />
        <Link href={blogHref} className="hover:text-foreground transition-colors shrink-0">{sectionLabel}</Link>
        <i className="ri-arrow-right-s-line text-muted-foreground/60 shrink-0" />
        <span className="text-foreground truncate min-w-0 max-w-[50vw] sm:max-w-[200px]">{post.title}</span>
      </nav>

      <article>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {categoryName && <span className="tag">{categoryName}</span>}
          {post.tags?.map((tag: { id: string; name: string }) => (
            <span key={tag.id} className="tag">{tag.name}</span>
          ))}
          {publishedAt && (
            <time className="text-sm text-muted-foreground flex items-center gap-1">
              <i className="ri-calendar-line" /> {publishedAt}
            </time>
          )}
          <LikeButton entityType="post" entityId={post.id} initialCount={post.likeCount} size="md" className="ml-auto" />
        </div>

        <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight tracking-tight">
          {post.title}
        </h1>

        {post.excerpt && (
          <CardDescriptionHtml
            html={post.excerpt}
            lines={false}
            className="text-lg text-muted-foreground mb-8 leading-relaxed"
          />
        )}

        <div className="flex items-center gap-3 mb-10 pb-10 border-b border-border">
          {authorAvatar ? (
            <div className="w-10 h-10 rounded-full overflow-hidden border border-border relative">
              <Image
                src={authorAvatar}
                unoptimized
                alt={authorName}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground text-sm">
              {authorName.slice(0, 1)}
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">{authorName}</p>
            {authorTitle && (
              <p className="text-sm text-muted-foreground">{authorTitle}</p>
            )}
          </div>
          <PostShare
            postId={post.id}
            slug={post.slug}
            title={post.title}
            excerpt={post.excerpt}
            coverImage={post.coverImage}
            categoryName={categoryName}
            tags={(post.tags ?? []).map((tg: { name: string }) => tg.name)}
            date={post.publishedAt ?? post.createdAt}
            initialShareCount={post.shareCount ?? 0}
            className="ml-auto self-center"
            locale={resolvedLocale}
          />
        </div>

        {(contentHtml || bodyPlain) && (
          <div className="min-w-0 [overflow-x:clip] xl:grid xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-12">
            <ArticleOutline headings={contentHeadings} locale={resolvedLocale} mode="desktop" />
            <div className="min-w-0">
              <ArticleOutline headings={contentHeadings} locale={resolvedLocale} mode="mobile" />
              <ProseImageLightbox>
                <div
                className="prose prose-neutral dark:prose-invert prose-lg max-w-none
                  prose-headings:font-serif prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
                  prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:scroll-mt-24
                  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-h3:scroll-mt-24
                  prose-p:text-foreground/70 prose-p:leading-relaxed
                  prose-li:text-foreground/70
                  prose-strong:text-foreground
                  prose-theme prose-a:no-underline hover:prose-a:underline
                  prose-code:bg-accent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                  prose-pre:bg-accent prose-pre:border prose-pre:border-border
                  prose-blockquote:text-muted-foreground
                  prose-img:rounded-lg prose-img:my-4
                  prose-mark:bg-yellow-200/80 prose-mark:dark:bg-yellow-900/40
                  [&_.tiptap-img]:rounded-lg
                  [&_figure]:my-6 [&_figure]:overflow-hidden [&_figure]:!max-w-full [&_figure_img]:my-0 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_figcaption]:mt-2
                  [&_.checklist]:list-none [&_.checklist]:pl-0 [&_.checklist_li]:flex [&_.checklist_li]:items-start [&_.checklist_li]:gap-2
                  [&_img]:!max-w-full [&_img]:h-auto [&_img]:object-contain [&_img]:rounded-lg
                  [&_video]:!max-w-full [&_video]:h-auto [&_video]:rounded-lg
                "
                >
                  {contentHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                  ) : (
                    bodyPlain.split("\n").map((line, i) => (
                      <p key={i}>{line || "\u00A0"}</p>
                    ))
                  )}
                </div>
              </ProseImageLightbox>
            </div>
          </div>
        )}

        <PostCTA product={post.ctaProduct} label={post.ctaLabel} />

        <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
          <Link
            href={blogHref}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 pride-underline"
          >
            <i className="ri-arrow-left-line" /> {t(dict, "frontend.back_to_blog", "返回文章列表")}
          </Link>
        </div>
      </article>

      <BackToTop />
    </div>
  )
}
