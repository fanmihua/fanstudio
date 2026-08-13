"use client"
/** 前台首页：Hero、设计/开发作品、笔记、教程等区块，文案来自设置与默认配置。 */
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { GlowBorder, FadeContent, AuroraBackground } from "@/components/react-bits"
import { useNavConfig } from "@/hooks/useNavConfig"
import { useFrontendSettingsContext } from "@/contexts/FrontendSettingsContext"
import { CardDescriptionHtml } from "@/components/frontend/CardDescriptionHtml"
import { getBeijingVolLabel } from "@/lib/date-util"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy, defaultSiteName, resolveFrontendSectionVisibility, resolveNavOrder, type PageCopy } from "@/lib/page-copy"
import { SOCIAL_LINK_ENTRIES, getSocialEntryLabel, normalizeSocialUrl, isImageUrl } from "@/lib/social-links"
import { HoverPopover } from "@/components/ui/hover-popover"
import { CoverImage } from "@/components/frontend/CoverImage"
import type { AboutModules } from "@/lib/about-types"
import { coverRatioToCss } from "@/lib/cover-ratio"
import { getDictionary } from "@/locales"
import { t, type I18nDict } from "@/lib/i18n"

type Settings = {
  siteName?: string
  avatar?: string | null
  about?: AboutModules | null
  aiAssistant?: { enabled?: boolean } | null
  socialLinks?: { wechat?: string; xiaohongshu?: string; officialAccount?: string; bilibili?: string; figma?: string; youshe?: string; x?: string; github?: string; email?: string; weibo?: string; dribbble?: string; behance?: string } | null
  pageCopy?: PageCopy | null
  nav?: { logoText?: string; worksDesign?: string; worksDev?: string; blog?: string; tutorials?: string } | null
}

type TagItem = { id: string; name: string }

type WorkItem = {
  id: string
  title: string
  slug: string
  description?: string | null
  coverImage?: string | null
  category?: { name: string } | null
  tags?: TagItem[]
  isFree?: boolean
  price?: number | null
}

type PostItem = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  coverImage?: string | null
  createdAt: string
  category?: { name: string } | null
  tags?: TagItem[]
}

type TutorialItem = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail?: string | null
  videoUrl: string
  sortOrder: number
  category?: { name: string } | null
  tags?: TagItem[]
}

export default function HomePage() {
  const { nav, pageCopy, siteName, socialLinks: contextSocialLinks, locale } = useNavConfig()
  const frontendCtx = useFrontendSettingsContext()
  const heroAssistantEnabled = frontendCtx?.aiAssistant?.enabled !== false
  const dict = getDictionary(locale)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [designWorks, setDesignWorks] = useState<WorkItem[]>([])
  const [devWorks, setDevWorks] = useState<WorkItem[]>([])
  const [posts, setPosts] = useState<PostItem[]>([])
  const [tutorials, setTutorials] = useState<TutorialItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/settings?locale=${locale}`).then((r) => r.json()),
      fetch(`/api/works?type=design&locale=${locale}`).then((r) => r.json()),
      fetch(`/api/works?type=development&locale=${locale}`).then((r) => r.json()),
      fetch(`/api/posts?locale=${locale}`).then((r) => r.json()),
      fetch(`/api/tutorials?locale=${locale}`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([s, designW, devW, p, t]) => {
        if (s && typeof s === "object" && !("error" in s)) {
          setSettings(s)
        }
        setDesignWorks(Array.isArray(designW) ? designW : [])
        setDevWorks(Array.isArray(devW) ? devW : [])
        setPosts(Array.isArray(p) ? p : [])
        setTutorials(Array.isArray(t) ? t : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locale])

  const articles = posts.slice(0, 4).map((p) => ({
    title: p.title,
    excerpt: p.excerpt ?? null,
    coverImage: p.coverImage ?? null,
    date: new Date(p.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "."),
    slug: p.slug,
    category: p.category,
    tags: p.tags,
  }))

  const designTitle = nav.worksDesign ?? defaultNav.worksDesign ?? ""
  const devTitle = nav.worksDev ?? defaultNav.worksDev ?? ""
  const notesTitle = nav.blog ?? defaultNav.blog ?? ""
  const tutorialsTitle = nav.tutorials ?? defaultNav.tutorials ?? ""
  const designCoverRatio = pageCopy.coverRatioWorksDesign
  const devCoverRatio = pageCopy.coverRatioWorksDev
  const blogCoverRatio = pageCopy.coverRatioBlog
  const tutorialsCoverRatio = pageCopy.coverRatioTutorials
  const sectionVisibility = resolveFrontendSectionVisibility(settings?.pageCopy ?? pageCopy)
  const navOrder = resolveNavOrder(settings?.pageCopy ?? pageCopy)
  const heroDisplayName =
    settings?.siteName ??
    siteName ??
    settings?.about?.profileCard?.personalName ??
    nav.logoText ??
    defaultSiteName

  return (
    <div className="min-h-screen">
      <HeroSection
        settings={settings}
        aiAssistantEnabled={heroAssistantEnabled}
        pageCopy={pageCopy}
        siteName={heroDisplayName}
        fallbackSocialLinks={contextSocialLinks}
        aboutLabel={nav.about ?? defaultNav.about ?? ""}
        locale={locale}
        dict={dict}
      />
      {navOrder.map((key) => {
        if (key === "worksDesign") {
          return sectionVisibility.worksDesign ? (
            <WorksGridSection
              key="worksDesign"
              title={designTitle}
              allLinkHref="/works/design"
              works={designWorks.slice(0, 4)}
              fallbackIcon="ri-palette-line"
              showPrice
              coverRatio={designCoverRatio}
              loading={loading}
              dict={dict}
            />
          ) : null
        }
        if (key === "worksDev") {
          return sectionVisibility.worksDev ? (
            <WorksGridSection
              key="worksDev"
              title={devTitle}
              allLinkHref="/works/development"
              works={devWorks.slice(0, 4)}
              fallbackIcon="ri-code-s-slash-line"
              showPrice={false}
              coverRatio={devCoverRatio}
              loading={loading}
              dict={dict}
            />
          ) : null
        }
        if (key === "blog") {
          return sectionVisibility.blog ? (
            <NotesSection key="blog" title={notesTitle} articles={articles} coverRatio={blogCoverRatio} loading={loading} dict={dict} />
          ) : null
        }
        if (key === "tutorials") {
          return sectionVisibility.tutorials ? (
            <TutorialsSection key="tutorials" title={tutorialsTitle} items={tutorials.slice(0, 4)} coverRatio={tutorialsCoverRatio} loading={loading} dict={dict} />
          ) : null
        }
        return null
      })}
    </div>
  )
}

type PageCopyForHero = {
  heroGreeting?: string
  heroPrefix?: string
  heroDesc?: string
  showResume?: boolean
  showPortfolio?: boolean
  resumeUrl?: string
  portfolioUrl?: string
}

type HeroTextMotion = "reveal" | "lift" | "focus" | "type"

const HERO_TEXT_MOTION_OPTIONS: Array<{ value: HeroTextMotion; label: string }> = [
  { value: "reveal", label: "行间揭示" },
  { value: "lift", label: "轻柔上浮" },
  { value: "focus", label: "品牌聚焦" },
  { value: "type", label: "Text Type" },
]

function HeroTextType({ text }: { text: string }) {
  const characters = Array.from(text)
  const [visibleCharacters, setVisibleCharacters] = useState(0)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const typeNextCharacter = (index: number) => {
      timeout = setTimeout(
        () => {
          setVisibleCharacters(index + 1)
          if (index + 1 < characters.length) typeNextCharacter(index + 1)
        },
        index === 0 ? 120 : 42,
      )
    }

    if (characters.length > 0) typeNextCharacter(0)
    return () => clearTimeout(timeout)
  }, [text, characters.length])

  return (
    <span className="block mt-2 md:whitespace-nowrap overflow-visible" aria-label={text}>
      <span aria-hidden="true">{characters.slice(0, visibleCharacters).join("")}</span>
      <motion.span
        aria-hidden="true"
        className="ml-[0.08em] inline-block h-[0.82em] w-[0.055em] translate-y-[0.06em] rounded-full"
        style={{ background: "var(--pride-gradient)" }}
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
      />
    </span>
  )
}

function HeroAnimatedTitle({
  greeting,
  prefix,
  name,
  variant,
}: {
  greeting: string
  prefix: string
  name: string
  variant: HeroTextMotion
}) {
  const reduceMotion = useReducedMotion()
  const secondLine = (
    <>
      <span className="text-foreground">{prefix}</span>
      {" "}
      <span className="text-foreground">{name}</span>
    </>
  )

  if (reduceMotion) {
    return (
      <>
        <span className="block text-foreground">{greeting}</span>
        <span className="block mt-2 md:whitespace-nowrap overflow-visible">{secondLine}</span>
      </>
    )
  }

  if (variant === "type") {
    return (
      <>
        <span className="block text-foreground">{greeting}</span>
        <HeroTextType text={`${prefix} ${name}`} />
      </>
    )
  }

  if (variant === "lift") {
    return (
      <>
        <motion.span
          key="lift-greeting"
          className="block text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {greeting}
        </motion.span>
        <motion.span
          key="lift-brand"
          className="block mt-2 md:whitespace-nowrap overflow-visible"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          {secondLine}
        </motion.span>
      </>
    )
  }

  if (variant === "focus") {
    return (
      <>
        <span className="block text-foreground">{greeting}</span>
        <span className="block mt-2 md:whitespace-nowrap overflow-visible">
          <span className="text-foreground">{prefix}</span>
          {" "}
          <motion.span
            key="focus-brand"
            className="inline-block text-foreground"
            initial={{ opacity: 0.35, x: 6, letterSpacing: "0.025em" }}
            animate={{ opacity: 1, x: 0, letterSpacing: "-0.01em" }}
            transition={{ duration: 0.34, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            {name}
          </motion.span>
        </span>
      </>
    )
  }

  return (
    <>
      <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
        <motion.span
          key="reveal-greeting"
          className="block text-foreground"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        >
          {greeting}
        </motion.span>
      </span>
      <span className="block mt-2 overflow-hidden pb-[0.08em] -mb-[0.08em] md:whitespace-nowrap">
        <motion.span
          key="reveal-brand"
          className="block text-foreground"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 0.36, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {secondLine}
        </motion.span>
      </span>
    </>
  )
}

function HeroSection({
  settings,
  aiAssistantEnabled = true,
  pageCopy,
  siteName: heroSiteName,
  fallbackSocialLinks,
  aboutLabel,
  locale,
  dict,
}: {
  settings: Settings | null
  aiAssistantEnabled?: boolean
  pageCopy?: PageCopyForHero
  siteName?: string
  fallbackSocialLinks?: Record<string, string | undefined> | null
  aboutLabel?: string
  locale: "zh" | "en"
  dict: I18nDict
}) {
  const [heroTextMotion, setHeroTextMotion] = useState<HeroTextMotion>("type")
  const openAssistant = (question?: string, autoSend = false) => {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("site-ai-assistant:open", {
        detail: { question, autoSend },
      }),
    )
  }

  const name = heroSiteName ?? defaultSiteName
  const copy = settings?.pageCopy ?? pageCopy
  const heroGreeting = copy?.heroGreeting ?? defaultPageCopy.heroGreeting ?? ""
  const heroPrefix = copy?.heroPrefix ?? defaultPageCopy.heroPrefix ?? ""
  const desc =
    copy?.heroDesc ?? (defaultPageCopy.heroDesc ?? "")
  const avatar = settings?.avatar ?? ""
  const links = settings?.socialLinks ?? fallbackSocialLinks ?? {}
  const showHeroAssistant = aiAssistantEnabled
  // 简历 / 作品集入口：与关于页共用后台开关与链接（默认显示、默认链接）
  const showResume = copy?.showResume !== false
  const showPortfolio = copy?.showPortfolio !== false
  const resumeUrl = copy?.resumeUrl || defaultPageCopy.resumeUrl || ""
  const portfolioUrl = copy?.portfolioUrl || defaultPageCopy.portfolioUrl || ""

  return (
    <section className="relative min-h-[85vh] flex flex-col justify-center px-6 md:px-12 lg:px-16 py-20 overflow-x-visible overflow-y-hidden">
      <AuroraBackground className="opacity-20 dark:opacity-30" />

      {process.env.NODE_ENV === "development" ? (
        <div className="absolute right-6 top-6 z-20 hidden items-center gap-1 rounded-full border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur md:flex">
          <span className="px-2 text-[11px] text-muted-foreground">文字动画</span>
          {HERO_TEXT_MOTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setHeroTextMotion(option.value)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                heroTextMotion === option.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative z-10 max-w-4xl overflow-visible">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono border border-border/50 px-3 py-1 rounded-full">
            {getBeijingVolLabel()}
          </span>
          <div className="h-[1px] w-12 bg-border" />
        </div>

        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight mb-6 overflow-visible">
          <HeroAnimatedTitle
            key={heroTextMotion}
            greeting={heroGreeting}
            prefix={heroPrefix}
            name={name}
            variant={heroTextMotion}
          />
        </h1>

        <div className="mb-8">
          <p className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">{desc}</p>
        </div>

        {showHeroAssistant ? (
          <div className="mb-8 w-full max-w-[640px]">
            <div className="hero-ai-flow-outer">
              <div className="hero-ai-flow-inner rounded-2xl p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-[color:var(--background)]" style={{ background: "var(--foreground)" }}>
                      AI
                    </span>
                    <p className="text-foreground font-medium truncate">{t(dict, "frontend.hero_ai_intro", "懒得翻页？我用 30 秒带你认识我。")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAssistant(t(dict, "frontend.hero_ai_quick_prompt", "可以简单介绍一下你吗？"), true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                    >
                      {t(dict, "frontend.hero_ai_quick_recommend", "自我介绍")} <i className="ri-magic-line text-[11px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openAssistant()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                    >
                      {t(dict, "frontend.hero_ai_open_assistant", "打开助手")} <i className="ri-arrow-right-up-line text-[11px]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {(showResume && resumeUrl) || (showPortfolio && portfolioUrl) ? (
          <div className="flex items-center gap-3 flex-wrap mb-6">
            {showResume && resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <i className="ri-file-user-line text-base" />
                {t(dict, "frontend.view_resume", "查看简历")}
              </a>
            )}
            {showPortfolio && portfolioUrl && (
              <a
                href={portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <i className="ri-image-2-line text-base" />
                {t(dict, "frontend.view_portfolio", "查看作品集")}
              </a>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border ring-2 ring-background relative shrink-0">
              {avatar ? (
                <Image
                  src={avatar}
                  unoptimized
                  alt={name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="w-full h-full bg-accent flex items-center justify-center text-muted-foreground">
                  <i className="ri-user-line text-xl" />
                </div>
              )}
            </div>
            <Link href="/about" className="pride-underline text-sm font-medium text-foreground">
              {aboutLabel || t(dict, "frontend.hero_about", "关于")}
            </Link>
            <span className="text-border">·</span>
            {SOCIAL_LINK_ENTRIES.map(({ key, label, labelEn, icon, type }) => {
              const socialLabel = getSocialEntryLabel({ key, label, labelEn, icon, type }, locale)
              const value = links[key]
              if (!value?.trim()) return null
              if (type === "text") {
                const trimmed = value.trim()
                return (
                  <HoverPopover
                    key={key}
                    content={
                      isImageUrl(trimmed) ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={trimmed} alt={`${socialLabel}${t(dict, "frontend.qr_suffix", "二维码")}`} className="w-36 h-36 rounded-lg object-contain" />
                          <span className="text-xs text-muted-foreground">{socialLabel}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <i className={`${icon} text-base text-muted-foreground`} />
                          <span className="text-sm text-foreground font-medium">{trimmed}</span>
                          <button type="button" className="ml-1 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title={t(dict, "common.copy", "复制")} onClick={() => navigator.clipboard.writeText(trimmed)}>
                            <i className="ri-file-copy-line text-sm" />
                          </button>
                        </div>
                      )
                    }
                  >
                    <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-default">
                      {socialLabel}
                    </span>
                  </HoverPopover>
                )
              }
              return (
                <a key={key} href={normalizeSocialUrl(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {socialLabel}
                </a>
              )
            })}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-border/50" />
    </section>
  )
}

function SectionHeader({ title, linkHref, linkText }: { title: string; linkHref: string; linkText: string }) {
  return (
    <FadeContent>
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            {title}
          </h2>
          <div className="hidden md:block h-[1px] w-16 bg-border mt-2" />
        </div>
        <Link
          href={linkHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 pride-underline"
        >
          {linkText} <i className="ri-arrow-right-line text-xs" />
        </Link>
      </div>
    </FadeContent>
  )
}

function WorkPriceIndicator({ isFree, price }: { isFree?: boolean; price?: number | null }) {
  const displayPrice = isFree ? 0 : (price ?? 0)
  return (
    <span className="font-serif text-2xl font-bold tracking-tight text-foreground leading-none">
      <span className="text-sm font-normal text-muted-foreground mr-0.5">¥</span>{displayPrice}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-muted" />
      <div className="p-4 space-y-2.5">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-5 w-10 bg-muted rounded mt-3" />
        <div className="flex gap-1.5 mt-2">
          <div className="h-4 w-12 bg-muted rounded" />
          <div className="h-4 w-10 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  )
}

function WorksGridSection({
  title,
  allLinkHref,
  works,
  fallbackIcon,
  showPrice = true,
  coverRatio,
  loading,
  dict,
}: {
  title: string
  allLinkHref: string
  works: WorkItem[]
  fallbackIcon: string
  showPrice?: boolean
  coverRatio?: string
  loading?: boolean
  dict: I18nDict
}) {
  const emptyPrefix = t(dict, "common.empty_prefix", "暂无")
  const viewAll = t(dict, "common.view_all", "查看全部")
  const openSource = t(dict, "frontend.open_source", "开源")
  return (
    <section className="px-6 md:px-12 lg:px-16 py-16 md:py-24 border-t border-border/40 first:border-t-0">
      <SectionHeader title={title} linkHref={allLinkHref} linkText={viewAll} />

      {loading ? (
        <SkeletonGrid />
      ) : works.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">{emptyPrefix}{title}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {works.map((work, index) => (
            <FadeContent
              key={work.id}
              delay={0.1 + index * 0.05}
            >
              <Link href={`/works/${work.slug}`} className="block transition-transform duration-300 hover:scale-[1.1]">
                <GlowBorder className="group rounded-xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm flex flex-col">
                  <div
                    className="overflow-hidden bg-muted shrink-0 relative"
                    style={{ aspectRatio: coverRatioToCss(coverRatio) }}
                  >
                    <CoverImage src={work.coverImage} alt={work.title} fallbackIcon={fallbackIcon} />
                    {work.isFree && (
                      <span className="absolute top-2 left-2 z-10 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-500/90 text-white backdrop-blur-sm">
                        {openSource}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-base font-semibold text-foreground truncate group-hover:text-foreground/80 transition-colors">
                      {work.title}
                    </h3>
                    {work.description && (
                      <CardDescriptionHtml html={work.description} className="mt-1" />
                    )}
                    <div className="mt-auto pt-3 flex items-end justify-between gap-2">
                      <div className="flex flex-nowrap items-center gap-1.5 min-w-0 overflow-hidden">
                        {work.category?.name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded content-meta-pill-primary font-medium shrink-0 max-w-[3.5rem] truncate" title={work.category.name}>{work.category.name}</span>
                        )}
                        {(work.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag.id} className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0 max-w-[3.5rem] truncate" title={tag.name}>{tag.name}</span>
                        ))}
                        {(work.tags?.length ?? 0) > 3 && (
                          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0">+{(work.tags?.length ?? 0) - 3}</span>
                        )}
                      </div>
                      {showPrice ? <WorkPriceIndicator isFree={work.isFree} price={work.price} /> : null}
                    </div>
                  </div>
                </GlowBorder>
              </Link>
            </FadeContent>
          ))}
        </div>
      )}
    </section>
  )
}


function NotesSection({
  title,
  articles,
  coverRatio,
  loading,
  dict,
}: {
  title: string
  articles: { title: string; excerpt: string | null; coverImage: string | null; date: string; slug: string; category?: { name: string } | null; tags?: TagItem[] }[]
  coverRatio?: string
  loading?: boolean
  dict: I18nDict
}) {
  const emptyPrefix = t(dict, "common.empty_prefix", "暂无")
  const viewAll = t(dict, "common.view_all", "查看全部")
  return (
    <section className="px-6 md:px-12 lg:px-16 py-16 md:py-24 border-t border-border/40">
      <SectionHeader title={title} linkHref="/blog" linkText={viewAll} />

      {loading ? (
        <SkeletonGrid />
      ) : articles.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">{emptyPrefix}{title}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {articles.map((article, index) => (
            <FadeContent
              key={article.slug}
              delay={0.1 + index * 0.05}
            >
              <Link href={`/blog/${article.slug}`} className="block transition-transform duration-300 hover:scale-[1.1]">
                <GlowBorder className="group rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">
                  <div
                    className="overflow-hidden bg-muted shrink-0"
                    style={{ aspectRatio: coverRatioToCss(coverRatio) }}
                  >
                    <CoverImage src={article.coverImage} alt={article.title} fallbackIcon="ri-article-line" />
                  </div>
                  <div className="p-4 flex-1">
                    <h3 className="text-base font-semibold text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors mb-1">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <CardDescriptionHtml html={article.excerpt} className="mt-1.5" />
                    )}
                    <div className="flex items-center gap-2 mt-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground/60 shrink-0">{article.date}</span>
                      {(article.category?.name || (article.tags && article.tags.length > 0)) && (
                        <div className="flex flex-nowrap items-center gap-1.5 min-w-0 overflow-hidden">
                          {article.category?.name && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded content-meta-pill-primary font-medium shrink-0 max-w-[3.5rem] truncate" title={article.category.name}>{article.category.name}</span>
                          )}
                          {(article.tags ?? []).slice(0, 3).map((tag) => (
                            <span key={tag.id} className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0 max-w-[3.5rem] truncate" title={tag.name}>{tag.name}</span>
                          ))}
                          {(article.tags?.length ?? 0) > 3 && (
                            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0">+{(article.tags?.length ?? 0) - 3}</span>
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
    </section>
  )
}


function TutorialsSection({
  title,
  items,
  coverRatio,
  loading,
  dict,
}: {
  title: string
  items: TutorialItem[]
  coverRatio?: string
  loading?: boolean
  dict: I18nDict
}) {
  const emptyPrefix = t(dict, "common.empty_prefix", "暂无")
  const viewAll = t(dict, "common.view_all", "查看全部")
  const playOverlay = (
    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
      <i className="ri-play-circle-fill text-4xl text-white/90" />
    </div>
  )

  return (
    <section className="px-6 md:px-12 lg:px-16 py-16 md:py-24 border-t border-border/40">
      <SectionHeader title={title} linkHref="/tutorials" linkText={viewAll} />

      {loading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm py-4">{emptyPrefix}{title}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {items.map((item, index) => (
            <FadeContent
              key={item.id}
              delay={0.1 + index * 0.05}
            >
              <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="block transition-transform duration-300 hover:scale-[1.1]">
                <GlowBorder className="group rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">
                  <div
                    className="overflow-hidden bg-muted relative shrink-0"
                    style={{ aspectRatio: coverRatioToCss(coverRatio) }}
                  >
                    <CoverImage src={item.thumbnail} alt={item.title} fallbackIcon="ri-video-line" />
                    {playOverlay}
                  </div>
                  <div className="p-4 flex-1">
                    <h3 className="text-base font-medium text-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">
                      {item.title}
                    </h3>
                    {item.description && (
                      <CardDescriptionHtml html={item.description} className="mt-1.5" />
                    )}
                    {(item.category?.name || (item.tags && item.tags.length > 0)) && (
                      <div className="flex flex-nowrap items-center gap-1.5 mt-2 overflow-hidden">
                        {item.category?.name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded content-meta-pill-primary font-medium shrink-0 max-w-[3.5rem] truncate" title={item.category.name}>{item.category.name}</span>
                        )}
                        {(item.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag.id} className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0 max-w-[3.5rem] truncate" title={tag.name}>{tag.name}</span>
                        ))}
                        {(item.tags?.length ?? 0) > 3 && (
                          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded content-meta-pill-muted shrink-0">+{(item.tags?.length ?? 0) - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </GlowBorder>
              </a>
            </FadeContent>
          ))}
        </div>
      )}
    </section>
  )
}
