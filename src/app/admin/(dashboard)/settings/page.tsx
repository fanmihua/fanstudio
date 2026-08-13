"use client"
/** 网站设置页：基本设置、关于我、导航与页面文案、社交链接、外观主题。 */
import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { MiniEditor } from "@/components/admin/MiniEditor"
import { SOCIAL_LINK_ENTRIES, getSocialEntryLabel, isImageUrl, type SocialLinks } from "@/lib/social-links"
import {
  normalizeAboutModules,
  type AboutModules,
  type WorkExperienceItem,
  type EducationItem,
  type SkillItem,
} from "@/lib/about-types"
import { compressImageToDataUrl } from "@/lib/avatar-compress"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy, defaultSiteName, defaultPersonalName, normalizeSiteName, resolveNavOrder, type ReorderableNavKey } from "@/lib/page-copy"
import { defaultFooter, type FooterConfig } from "@/lib/version"
import {
  BASE_PRESETS,
  ACCENT_PRESETS,
  DEFAULT_THEME,
  type ThemeConfig,
  type BaseColorId,
  type AccentColorId,
} from "@/lib/theme-presets"
import { useThemeColor } from "@/components/ThemeColorProvider"
import { cn } from "@/lib/utils"
import {
  COVER_RATIO_OPTIONS,
  DEFAULT_COVER_RATIO,
  normalizeCoverRatio,
  type CoverRatioId,
} from "@/lib/cover-ratio"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type NavData = {
  logoText?: string
  worksDesign?: string
  worksDev?: string
  blog?: string
  about?: string
  tutorials?: string
}

type PageCopyData = {
  worksDesignDesc?: string
  worksDevDesc?: string
  blogDesc?: string
  tutorialsDesc?: string
  showWorksDesign?: boolean
  showWorksDev?: boolean
  showBlog?: boolean
  showTutorials?: boolean
  showLanguageSwitcher?: boolean
  navOrder?: string[]
  aboutDesc?: string
  showResume?: boolean
  showPortfolio?: boolean
  resumeUrl?: string
  portfolioUrl?: string
  heroGreeting?: string
  heroPrefix?: string
  heroDesc?: string
  siteDescription?: string
  siteFavicon?: string
  aboutWorkTitle?: string
  aboutEducationTitle?: string
  aboutSkillsTitle?: string
  coverRatioWorksDesign?: string
  coverRatioWorksDev?: string
  coverRatioBlog?: string
  coverRatioTutorials?: string
}

function normalizeAboutLocalePair(rawAbout: unknown, rawAboutI18n: unknown): { zh: AboutModules; en: AboutModules } {
  const rawFromAbout =
    rawAbout && typeof rawAbout === "object" && ("zh" in (rawAbout as Record<string, unknown>) || "en" in (rawAbout as Record<string, unknown>))
      ? (rawAbout as { zh?: unknown; en?: unknown })
      : null
  const rawFromAboutI18n =
    rawAboutI18n && typeof rawAboutI18n === "object"
      ? (rawAboutI18n as { zh?: unknown; en?: unknown })
      : null
  const merged = rawFromAboutI18n ?? rawFromAbout
  if (!merged) {
    return {
      zh: normalizeAboutModules(rawAbout as AboutModules | null),
      en: normalizeAboutModules(null),
    }
  }
  return {
    zh: normalizeAboutModules(merged.zh as AboutModules | null),
    en: normalizeAboutModules(merged.en as AboutModules | null),
  }
}

export default function SettingsPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])
  const [siteName, setSiteName] = useState(defaultSiteName)
  const [siteFavicon, setSiteFavicon] = useState("")
  const [avatar, setAvatar] = useState("")
  const [wechat, setWechat] = useState("")
  const [xiaohongshu, setXiaohongshu] = useState("")
  const [officialAccount, setOfficialAccount] = useState("")
  const [bilibili, setBilibili] = useState("")
  const [figma, setFigma] = useState("")
  const [youshe, setYoushe] = useState("")
  const [x, setX] = useState("")
  const [github, setGithub] = useState("")
  const [email, setEmail] = useState("")
  const [aboutIntro, setAboutIntro] = useState("")
  const [aboutIntroEn, setAboutIntroEn] = useState("")
  const [aboutStudioName, setAboutStudioName] = useState("")
  const [aboutStudioNameEn, setAboutStudioNameEn] = useState("")
  const [aboutPersonalName, setAboutPersonalName] = useState(defaultPersonalName)
  const [aboutPersonalNameEn, setAboutPersonalNameEn] = useState("")
  const [aboutPersonalTitle, setAboutPersonalTitle] = useState("")
  const [aboutPersonalTitleEn, setAboutPersonalTitleEn] = useState("")
  const [workExperience, setWorkExperience] = useState<WorkExperienceItem[]>([])
  const [workExperienceEn, setWorkExperienceEn] = useState<WorkExperienceItem[]>([])
  const [education, setEducation] = useState<EducationItem[]>([])
  const [educationEn, setEducationEn] = useState<EducationItem[]>([])
  const [aboutSkills, setAboutSkills] = useState<SkillItem[]>([])
  const [aboutSkillsEn, setAboutSkillsEn] = useState<SkillItem[]>([])
  const faviconFileInputRef = useRef<HTMLInputElement>(null)
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const [navWorksDesign, setNavWorksDesign] = useState(defaultNav.worksDesign ?? "")
  const [navWorksDev, setNavWorksDev] = useState(defaultNav.worksDev ?? "")
  const [navBlog, setNavBlog] = useState(defaultNav.blog ?? "")
  const [navAbout, setNavAbout] = useState(defaultNav.about ?? "")
  const [navTutorials, setNavTutorials] = useState(defaultNav.tutorials ?? "")
  const [navWorksDesignEn, setNavWorksDesignEn] = useState("")
  const [navWorksDevEn, setNavWorksDevEn] = useState("")
  const [navBlogEn, setNavBlogEn] = useState("")
  const [navAboutEn, setNavAboutEn] = useState("")
  const [navTutorialsEn, setNavTutorialsEn] = useState("")
  const [worksDesignDesc, setWorksDesignDesc] = useState(defaultPageCopy.worksDesignDesc ?? "")
  const [worksDevDesc, setWorksDevDesc] = useState(defaultPageCopy.worksDevDesc ?? "")
  const [blogDesc, setBlogDesc] = useState(defaultPageCopy.blogDesc ?? "")
  const [tutorialsDesc, setTutorialsDesc] = useState(defaultPageCopy.tutorialsDesc ?? "")
  const [showWorksDesign, setShowWorksDesign] = useState(defaultPageCopy.showWorksDesign ?? true)
  const [showWorksDev, setShowWorksDev] = useState(defaultPageCopy.showWorksDev ?? true)
  const [showBlog, setShowBlog] = useState(defaultPageCopy.showBlog ?? true)
  const [showTutorials, setShowTutorials] = useState(defaultPageCopy.showTutorials ?? true)
  const [showLanguageSwitcher, setShowLanguageSwitcher] = useState(defaultPageCopy.showLanguageSwitcher ?? true)
  const [navOrder, setNavOrder] = useState<ReorderableNavKey[]>(() => resolveNavOrder(defaultPageCopy))
  const [aboutDesc, setAboutDesc] = useState(defaultPageCopy.aboutDesc ?? "")
  const [showResume, setShowResume] = useState(defaultPageCopy.showResume ?? true)
  const [showPortfolio, setShowPortfolio] = useState(defaultPageCopy.showPortfolio ?? true)
  const [resumeUrl, setResumeUrl] = useState(defaultPageCopy.resumeUrl ?? "")
  const [portfolioUrl, setPortfolioUrl] = useState(defaultPageCopy.portfolioUrl ?? "")
  const [heroGreeting, setHeroGreeting] = useState(defaultPageCopy.heroGreeting ?? "")
  const [heroPrefix, setHeroPrefix] = useState(defaultPageCopy.heroPrefix ?? "")
  const [heroDesc, setHeroDesc] = useState(defaultPageCopy.heroDesc ?? "")
  const [worksDesignDescEn, setWorksDesignDescEn] = useState("")
  const [worksDevDescEn, setWorksDevDescEn] = useState("")
  const [blogDescEn, setBlogDescEn] = useState("")
  const [tutorialsDescEn, setTutorialsDescEn] = useState("")
  const [aboutDescEn, setAboutDescEn] = useState("")
  const [heroGreetingEn, setHeroGreetingEn] = useState("")
  const [heroPrefixEn, setHeroPrefixEn] = useState("")
  const [heroDescEn, setHeroDescEn] = useState("")
  const [contentLocale, setContentLocale] = useState<"zh" | "en">(locale === "en" ? "en" : "zh")
  const [defaultLocale, setDefaultLocale] = useState<"zh" | "en">("zh")
  const [siteDescription, setSiteDescription] = useState(defaultPageCopy.siteDescription ?? "")
  const [aboutWorkTitle, setAboutWorkTitle] = useState(defaultPageCopy.aboutWorkTitle ?? "")
  const [aboutEducationTitle, setAboutEducationTitle] = useState(defaultPageCopy.aboutEducationTitle ?? "")
  const [aboutSkillsTitle, setAboutSkillsTitle] = useState(defaultPageCopy.aboutSkillsTitle ?? "")
  const [aboutWorkTitleEn, setAboutWorkTitleEn] = useState("")
  const [aboutEducationTitleEn, setAboutEducationTitleEn] = useState("")
  const [aboutSkillsTitleEn, setAboutSkillsTitleEn] = useState("")
  const [coverRatioWorksDesign, setCoverRatioWorksDesign] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const [coverRatioWorksDev, setCoverRatioWorksDev] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const [coverRatioBlog, setCoverRatioBlog] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const [coverRatioTutorials, setCoverRatioTutorials] = useState<CoverRatioId>(DEFAULT_COVER_RATIO)
  const [themeBase, setThemeBase] = useState<BaseColorId>(DEFAULT_THEME.base)
  const [themeAccent, setThemeAccent] = useState<AccentColorId>(DEFAULT_THEME.accent)
  const [footerCopyrightText, setFooterCopyrightText] = useState(defaultFooter.copyrightText ?? "")
  const [footerVersion, setFooterVersion] = useState(defaultFooter.version ?? "")
  const [savingTheme, setSavingTheme] = useState(false)
  const { setThemeConfig } = useThemeColor()
  const [loading, setLoading] = useState(true)
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingNavPage, setSavingNavPage] = useState(false)
  const [faviconPreviewFailed, setFaviconPreviewFailed] = useState(false)
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false)

  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSiteName(normalizeSiteName(data.siteName))
        setAvatar(data.avatar ?? "")
        setAvatarPreviewFailed(false)
        const links = (data.socialLinks as SocialLinks) || {}
        setWechat(links.wechat ?? "")
        setXiaohongshu(links.xiaohongshu ?? "")
        setOfficialAccount(links.officialAccount ?? "")
        setBilibili(links.bilibili ?? "")
        setFigma(links.figma ?? "")
        setYoushe(links.youshe ?? "")
        setX(links.x ?? "")
        setGithub(links.github ?? "")
        setEmail(links.email ?? "")
        const localizedAbout = normalizeAboutLocalePair(data.about, data.aboutI18n)
        const normalized = localizedAbout.zh
        const normalizedEn = localizedAbout.en
        setAboutIntro(normalized.intro ?? "")
        setAboutIntroEn(normalizedEn.intro ?? "")
        const pc = normalized.profileCard
        const pcEn = normalizedEn.profileCard
        setAboutStudioName(pc?.studioName ?? "")
        setAboutStudioNameEn(pcEn?.studioName ?? "")
        setAboutPersonalName(pc?.personalName ?? defaultPersonalName)
        setAboutPersonalNameEn(pcEn?.personalName ?? "")
        setAboutPersonalTitle(pc?.personalTitle ?? "")
        setAboutPersonalTitleEn(pcEn?.personalTitle ?? "")
        setWorkExperience(normalized.workExperience ?? [])
        setWorkExperienceEn(normalizedEn.workExperience ?? [])
        setEducation(normalized.education ?? [])
        setEducationEn(normalizedEn.education ?? [])
        setAboutSkills(normalized.skills ?? [])
        setAboutSkillsEn(normalizedEn.skills ?? [])
        const nav = (data.nav as NavData) || {}
        const navI18n = (data.navI18n as { en?: NavData }) || {}
        setNavWorksDesign(nav.worksDesign ?? defaultNav.worksDesign ?? "")
        setNavWorksDev(nav.worksDev ?? defaultNav.worksDev ?? "")
        setNavBlog(nav.blog ?? defaultNav.blog ?? "")
        setNavAbout(nav.about ?? defaultNav.about ?? "")
        setNavTutorials(nav.tutorials ?? defaultNav.tutorials ?? "")
        setNavWorksDesignEn(navI18n.en?.worksDesign ?? "")
        setNavWorksDevEn(navI18n.en?.worksDev ?? "")
        setNavBlogEn(navI18n.en?.blog ?? "")
        setNavAboutEn(navI18n.en?.about ?? "")
        setNavTutorialsEn(navI18n.en?.tutorials ?? "")
        const copy = (data.pageCopy as PageCopyData) || {}
        const pageCopyI18n = (data.pageCopyI18n as { en?: PageCopyData }) || {}
        setWorksDesignDesc(copy.worksDesignDesc ?? defaultPageCopy.worksDesignDesc ?? "")
        setWorksDevDesc(copy.worksDevDesc ?? defaultPageCopy.worksDevDesc ?? "")
        setBlogDesc(copy.blogDesc ?? defaultPageCopy.blogDesc ?? "")
        setTutorialsDesc(copy.tutorialsDesc ?? defaultPageCopy.tutorialsDesc ?? "")
        setShowWorksDesign(copy.showWorksDesign ?? defaultPageCopy.showWorksDesign ?? true)
        setShowWorksDev(copy.showWorksDev ?? defaultPageCopy.showWorksDev ?? true)
        setShowBlog(copy.showBlog ?? defaultPageCopy.showBlog ?? true)
        setShowTutorials(copy.showTutorials ?? defaultPageCopy.showTutorials ?? true)
        setShowLanguageSwitcher(copy.showLanguageSwitcher ?? defaultPageCopy.showLanguageSwitcher ?? true)
        setNavOrder(resolveNavOrder({ navOrder: copy.navOrder }))
        setAboutDesc(copy.aboutDesc ?? defaultPageCopy.aboutDesc ?? "")
        setShowResume(copy.showResume ?? defaultPageCopy.showResume ?? true)
        setShowPortfolio(copy.showPortfolio ?? defaultPageCopy.showPortfolio ?? true)
        setResumeUrl(copy.resumeUrl ?? defaultPageCopy.resumeUrl ?? "")
        setPortfolioUrl(copy.portfolioUrl ?? defaultPageCopy.portfolioUrl ?? "")
        setHeroGreeting(copy.heroGreeting ?? defaultPageCopy.heroGreeting ?? "")
        setHeroPrefix(copy.heroPrefix ?? defaultPageCopy.heroPrefix ?? "")
        setHeroDesc(copy.heroDesc ?? defaultPageCopy.heroDesc ?? "")
        setWorksDesignDescEn(pageCopyI18n.en?.worksDesignDesc ?? "")
        setWorksDevDescEn(pageCopyI18n.en?.worksDevDesc ?? "")
        setBlogDescEn(pageCopyI18n.en?.blogDesc ?? "")
        setTutorialsDescEn(pageCopyI18n.en?.tutorialsDesc ?? "")
        setAboutDescEn(pageCopyI18n.en?.aboutDesc ?? "")
        setHeroGreetingEn(pageCopyI18n.en?.heroGreeting ?? "")
        setHeroPrefixEn(pageCopyI18n.en?.heroPrefix ?? "")
        setHeroDescEn(pageCopyI18n.en?.heroDesc ?? "")
        setDefaultLocale(data.defaultLocale === "en" ? "en" : "zh")
        setSiteDescription(copy.siteDescription ?? defaultPageCopy.siteDescription ?? "")
        setSiteFavicon(copy.siteFavicon ?? "")
        setFaviconPreviewFailed(false)
        setAboutWorkTitle(copy.aboutWorkTitle ?? defaultPageCopy.aboutWorkTitle ?? "")
        setAboutEducationTitle(copy.aboutEducationTitle ?? defaultPageCopy.aboutEducationTitle ?? "")
        setAboutSkillsTitle(copy.aboutSkillsTitle ?? defaultPageCopy.aboutSkillsTitle ?? "")
        setAboutWorkTitleEn(pageCopyI18n.en?.aboutWorkTitle ?? "")
        setAboutEducationTitleEn(pageCopyI18n.en?.aboutEducationTitle ?? "")
        setAboutSkillsTitleEn(pageCopyI18n.en?.aboutSkillsTitle ?? "")
        setCoverRatioWorksDesign(normalizeCoverRatio(copy.coverRatioWorksDesign))
        setCoverRatioWorksDev(normalizeCoverRatio(copy.coverRatioWorksDev))
        setCoverRatioBlog(normalizeCoverRatio(copy.coverRatioBlog))
        setCoverRatioTutorials(normalizeCoverRatio(copy.coverRatioTutorials))
        const ft = data.footer as FooterConfig | undefined
        if (ft && typeof ft === "object") {
          setFooterCopyrightText(ft.copyrightText ?? defaultFooter.copyrightText ?? "")
          setFooterVersion(ft.version ?? defaultFooter.version ?? "")
        }
        const theme = data.theme as ThemeConfig | undefined
        if (theme && typeof theme === "object") {
          setThemeBase(theme.base ?? DEFAULT_THEME.base)
          setThemeAccent(theme.accent ?? DEFAULT_THEME.accent)
        }
      })
      .catch(() => toast.error(t("加载设置失败", "Failed to load settings")))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => {
    setContentLocale(locale === "en" ? "en" : "zh")
  }, [locale])

  async function saveGeneral() {
    setSavingGeneral(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          siteName: siteName.trim() || defaultSiteName,
          socialLinks: {
            wechat: wechat.trim() || undefined,
            xiaohongshu: xiaohongshu.trim() || undefined,
            officialAccount: officialAccount.trim() || undefined,
            bilibili: bilibili.trim() || undefined,
            figma: figma.trim() || undefined,
            youshe: youshe.trim() || undefined,
            x: x.trim() || undefined,
            github: github.trim() || undefined,
            email: email.trim() || undefined,
          },
          footer: {
            copyrightText: footerCopyrightText.trim() || undefined,
            version: footerVersion.trim() || undefined,
          },
          pageCopy: {
            siteDescription: siteDescription.trim(),
            siteFavicon: siteFavicon.trim(),
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = (data.detail as string) || (data.error as string) || t("保存失败", "Save failed")
        toast.error(detail)
        return
      }
      const data = await res.json().catch(() => null)
      const savedFavicon = data?.pageCopy?.siteFavicon
      if (typeof savedFavicon === "string") {
        setSiteFavicon(savedFavicon)
        setFaviconPreviewFailed(false)
      }
      toast.success(t("已保存", "Saved"))
    } finally {
      setSavingGeneral(false)
    }
  }

  function moveNav(index: number, dir: -1 | 1) {
    setNavOrder((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const navLabelMap: Record<ReorderableNavKey, string> = {
    worksDesign: navWorksDesign.trim() || (defaultNav.worksDesign ?? ""),
    worksDev: navWorksDev.trim() || (defaultNav.worksDev ?? ""),
    blog: navBlog.trim() || (defaultNav.blog ?? ""),
    tutorials: navTutorials.trim() || (defaultNav.tutorials ?? ""),
  }

  async function saveNavAndPage() {
    setSavingNavPage(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nav: {
            worksDesign: navWorksDesign.trim() || (defaultNav.worksDesign ?? ""),
            worksDev: navWorksDev.trim() || (defaultNav.worksDev ?? ""),
            blog: navBlog.trim() || (defaultNav.blog ?? ""),
            about: navAbout.trim() || (defaultNav.about ?? ""),
            tutorials: navTutorials.trim() || (defaultNav.tutorials ?? ""),
          },
          navI18n: {
            zh: {
              worksDesign: navWorksDesign.trim() || (defaultNav.worksDesign ?? ""),
              worksDev: navWorksDev.trim() || (defaultNav.worksDev ?? ""),
              blog: navBlog.trim() || (defaultNav.blog ?? ""),
              about: navAbout.trim() || (defaultNav.about ?? ""),
              tutorials: navTutorials.trim() || (defaultNav.tutorials ?? ""),
            },
            en: {
              worksDesign: navWorksDesignEn.trim() || undefined,
              worksDev: navWorksDevEn.trim() || undefined,
              blog: navBlogEn.trim() || undefined,
              about: navAboutEn.trim() || undefined,
              tutorials: navTutorialsEn.trim() || undefined,
            },
          },
          pageCopy: {
            worksDesignDesc: worksDesignDesc.trim(),
            worksDevDesc: worksDevDesc.trim(),
            blogDesc: blogDesc.trim(),
            tutorialsDesc: tutorialsDesc.trim(),
            showWorksDesign,
            showWorksDev,
            showBlog,
            showTutorials,
            showLanguageSwitcher,
            showResume,
            showPortfolio,
            resumeUrl: resumeUrl.trim() || undefined,
            portfolioUrl: portfolioUrl.trim() || undefined,
            navOrder,
            aboutDesc: aboutDesc.trim(),
            heroGreeting: heroGreeting.trim(),
            heroPrefix: heroPrefix.trim() ? heroPrefix : "",
            heroDesc: heroDesc.trim(),
            aboutWorkTitle: aboutWorkTitle.trim(),
            aboutEducationTitle: aboutEducationTitle.trim(),
            aboutSkillsTitle: aboutSkillsTitle.trim(),
            coverRatioWorksDesign,
            coverRatioWorksDev,
            coverRatioBlog,
            coverRatioTutorials,
          },
          pageCopyI18n: {
            zh: {
              worksDesignDesc: worksDesignDesc.trim(),
              worksDevDesc: worksDevDesc.trim(),
              blogDesc: blogDesc.trim(),
              tutorialsDesc: tutorialsDesc.trim(),
              aboutDesc: aboutDesc.trim(),
              heroGreeting: heroGreeting.trim(),
              heroPrefix: heroPrefix.trim(),
              heroDesc: heroDesc.trim(),
              aboutWorkTitle: aboutWorkTitle.trim(),
              aboutEducationTitle: aboutEducationTitle.trim(),
              aboutSkillsTitle: aboutSkillsTitle.trim(),
            },
            en: {
              worksDesignDesc: worksDesignDescEn.trim() || undefined,
              worksDevDesc: worksDevDescEn.trim() || undefined,
              blogDesc: blogDescEn.trim() || undefined,
              tutorialsDesc: tutorialsDescEn.trim() || undefined,
              aboutDesc: aboutDescEn.trim() || undefined,
              heroGreeting: heroGreetingEn.trim() || undefined,
              heroPrefix: heroPrefixEn.trim() || undefined,
              heroDesc: heroDescEn.trim() || undefined,
              aboutWorkTitle: aboutWorkTitleEn.trim() || undefined,
              aboutEducationTitle: aboutEducationTitleEn.trim() || undefined,
              aboutSkillsTitle: aboutSkillsTitleEn.trim() || undefined,
            },
          },
          defaultLocale,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = (data.detail as string) || (data.error as string) || t("保存失败", "Save failed")
        toast.error(detail)
        return
      }
      toast.success(t("已保存", "Saved"))
    } finally {
      setSavingNavPage(false)
    }
  }

  async function saveProfile() {
    setSavingProfile(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          avatar: avatar.trim() || null,
          locale: contentLocale,
          about: {
            intro: aboutIntro.trim() || undefined,
            profileCard: {
              studioName: aboutStudioName.trim() || undefined,
              personalName: aboutPersonalName.trim() || undefined,
              personalTitle: aboutPersonalTitle.trim() || undefined,
            },
            workExperience: workExperience.filter(
              (item) =>
                [item.company, item.role, item.period, item.description].some((v) => v?.trim())
            ),
            education: education.filter((item) =>
              [item.school, item.degree, item.period].some((v) => v?.trim())
            ),
            skills: aboutSkills.filter((item) => (item.name ?? "").trim()),
          },
          aboutI18n: {
            zh: {
              intro: aboutIntro.trim() || undefined,
              profileCard: {
                studioName: aboutStudioName.trim() || undefined,
                personalName: aboutPersonalName.trim() || undefined,
                personalTitle: aboutPersonalTitle.trim() || undefined,
              },
              workExperience: workExperience.filter(
                (item) =>
                  [item.company, item.role, item.period, item.description].some((v) => v?.trim())
              ),
              education: education.filter((item) =>
                [item.school, item.degree, item.period].some((v) => v?.trim())
              ),
              skills: aboutSkills.filter((item) => (item.name ?? "").trim()),
            },
            en: {
              intro: aboutIntroEn.trim() || undefined,
              profileCard: {
                studioName: aboutStudioNameEn.trim() || undefined,
                personalName: aboutPersonalNameEn.trim() || undefined,
                personalTitle: aboutPersonalTitleEn.trim() || undefined,
              },
              workExperience: workExperienceEn.filter(
                (item) =>
                  [item.company, item.role, item.period, item.description].some((v) => v?.trim())
              ),
              education: educationEn.filter((item) =>
                [item.school, item.degree, item.period].some((v) => v?.trim())
              ),
              skills: aboutSkillsEn.filter((item) => (item.name ?? "").trim()),
            },
          },
        }),
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const detail = (data.detail as string) || (data.error as string) || t("保存失败", "Save failed")
        toast.error(detail)
        return
      }
      const data = await res.json().catch(() => null)
      if (typeof data?.avatar === "string" || data?.avatar === null) {
        setAvatar(data.avatar ?? "")
        setAvatarPreviewFailed(false)
      }
      toast.success(t("已保存", "Saved"))
    } catch (err) {
      clearTimeout(timeoutId)
      const isAbort = err instanceof Error && err.name === "AbortError"
      const msg = err instanceof Error ? err.message : t("网络错误或请求失败", "Network error or request failed")
      toast.error(
        isAbort
          ? t("请求超时，请检查网络或稍后重试；若使用本地上传头像，可改为填写图片链接或换小图", "Request timed out. Please retry later.")
          : msg.includes("body") || msg.includes("payload")
            ? t("请求体过大，请使用图片链接代替本地上传，或换一张更小的图片", "Payload too large, use image URL or smaller image.")
            : msg,
      )
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveTheme() {
    setSavingTheme(true)
    try {
      const themePayload: ThemeConfig = { base: themeBase, accent: themeAccent }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: themePayload }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data.detail as string) || (data.error as string) || t("保存失败", "Save failed"))
        return
      }
      setThemeConfig(themePayload)
      toast.success(t("主题已保存，刷新前台即可看到效果", "Theme saved. Refresh frontend to see changes."))
    } finally {
      setSavingTheme(false)
    }
  }

  /** 实时预览：更改主题选项后立即更新 Provider */
  function handleThemeBaseChange(id: BaseColorId) {
    setThemeBase(id)
    setThemeConfig({ base: id, accent: themeAccent })
  }

  function handleThemeAccentChange(id: AccentColorId) {
    setThemeAccent(id)
    setThemeConfig({ base: themeBase, accent: id })
  }

  const profileIntro = contentLocale === "en" ? aboutIntroEn : aboutIntro
  const setProfileIntro = (value: string) => (contentLocale === "en" ? setAboutIntroEn(value) : setAboutIntro(value))
  const profileStudioName = contentLocale === "en" ? aboutStudioNameEn : aboutStudioName
  const setProfileStudioName = (value: string) =>
    contentLocale === "en" ? setAboutStudioNameEn(value) : setAboutStudioName(value)
  const profilePersonalName = contentLocale === "en" ? aboutPersonalNameEn : aboutPersonalName
  const setProfilePersonalName = (value: string) =>
    contentLocale === "en" ? setAboutPersonalNameEn(value) : setAboutPersonalName(value)
  const profilePersonalTitle = contentLocale === "en" ? aboutPersonalTitleEn : aboutPersonalTitle
  const setProfilePersonalTitle = (value: string) =>
    contentLocale === "en" ? setAboutPersonalTitleEn(value) : setAboutPersonalTitle(value)
  const profileWorkExperience = contentLocale === "en" ? workExperienceEn : workExperience
  const setProfileWorkExperience = (next: WorkExperienceItem[]) =>
    contentLocale === "en" ? setWorkExperienceEn(next) : setWorkExperience(next)
  const profileEducation = contentLocale === "en" ? educationEn : education
  const setProfileEducation = (next: EducationItem[]) =>
    contentLocale === "en" ? setEducationEn(next) : setEducation(next)
  const profileSkills = contentLocale === "en" ? aboutSkillsEn : aboutSkills
  const setProfileSkills = (next: SkillItem[]) =>
    contentLocale === "en" ? setAboutSkillsEn(next) : setAboutSkills(next)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {t("加载中…", "Loading…")}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
          {t("网站设置", "Site Settings")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("管理你的网站配置，前台页面将显示这里的内容", "Manage site configuration shown on frontend pages.")}
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">{t("基本设置", "General")}</TabsTrigger>
          <TabsTrigger value="navpage">{t("导航与页面", "Navigation & Pages")}</TabsTrigger>
          <TabsTrigger value="profile">{t("关于我 / 头像", "About / Avatar")}</TabsTrigger>
          <TabsTrigger value="theme">{t("外观主题", "Theme")}</TabsTrigger>
          <TabsTrigger value="security">{t("账户安全", "Security")}</TabsTrigger>
        </TabsList>

        {/* ==================== 基本设置 ==================== */}
        <TabsContent value="general" className="space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("网站信息", "Site Info")}</CardTitle>
              <CardDescription>{t("网站名称会用于首页、导航、关于页等", "Site name is used on homepage, navigation and about page.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">{t("网站名称", "Site Name")}</Label>
                <Input
                  id="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteDescription">{t("网站描述", "Site Description")}</Label>
                <Input
                  id="siteDescription"
                  placeholder={defaultPageCopy.siteDescription}
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("用于浏览器标签页和搜索引擎展示", "Used in browser tabs and search engines.")}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t("浏览器图标（Favicon）", "Favicon")}</Label>
                {siteFavicon ? (
                  <div className="flex items-center gap-3">
                    {faviconPreviewFailed ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded border border-destructive/40 bg-destructive/5 text-destructive">
                        <i className="ri-image-close-line text-lg" />
                      </div>
                    ) : (
                      <img
                        src={siteFavicon}
                        alt={t("Favicon 预览", "Favicon Preview")}
                        className="h-10 w-10 rounded border border-border object-contain"
                        onError={() => {
                          setFaviconPreviewFailed(true)
                          toast.error(t("图标文件不可用，请重新上传 PNG", "Icon file is unavailable. Please upload a PNG again."))
                        }}
                      />
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => faviconFileInputRef.current?.click()}
                      >
                        {t("更换 PNG", "Replace PNG")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSiteFavicon("")
                          setFaviconPreviewFailed(false)
                        }}
                      >
                        {t("移除", "Remove")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => faviconFileInputRef.current?.click()}
                    >
                      <i className="ri-image-add-line mr-1.5" />
                      {t("上传 PNG 图标", "Upload PNG Icon")}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t("未上传时默认使用系统内置 favicon。上传后自动压缩为 256px 以内 PNG。", "If not uploaded, default favicon is used. Uploaded image is auto-compressed to <=256px PNG.")}
                    </p>
                  </div>
                )}
                <input
                  ref={faviconFileInputRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ""
                    if (!file) return
                    if (file.type !== "image/png") {
                      toast.error(t("仅支持 PNG 格式", "Only PNG is supported"))
                      return
                    }
                    compressImageToDataUrl(file, {
                      maxSize: 256,
                      mimeType: "image/png",
                    })
                      .then((next) => {
                        setSiteFavicon(next)
                        setFaviconPreviewFailed(false)
                      })
                      .catch(() => toast.error(t("图标压缩失败，请换一张 PNG", "Icon compression failed. Please try another PNG.")))
                  }}
                />
              </div>

              <Separator />

              <p className="text-sm font-semibold text-foreground">{t("页脚版权信息", "Footer Copyright")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="footerCopyrightText">{t("版权文字", "Copyright Text")}</Label>
                  <Input
                    id="footerCopyrightText"
                    placeholder={defaultFooter.copyrightText}
                    value={footerCopyrightText}
                    onChange={(e) => setFooterCopyrightText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("显示为", "Display as")} © {new Date().getFullYear()} {footerCopyrightText || defaultFooter.copyrightText}，{t("年份由系统自动生成", "year is auto-generated")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footerVersion">{t("版本号", "Version")}</Label>
                  <Input
                    id="footerVersion"
                    placeholder={defaultFooter.version}
                    value={footerVersion}
                    onChange={(e) => setFooterVersion(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("显示为", "Display as")} v{footerVersion || defaultFooter.version}
                  </p>
                </div>
              </div>

              <Button onClick={saveGeneral} disabled={savingGeneral}>
                {savingGeneral ? t("保存中…", "Saving…") : t("保存", "Save")}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("社交链接", "Social Links")}</CardTitle>
              <CardDescription>{t("将显示在页脚或关于页", "Shown in footer or about page.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {SOCIAL_LINK_ENTRIES.map(({ key, label, labelEn, icon, type }) => {
                  const socialLabel = getSocialEntryLabel({ key, label, labelEn, icon, type }, locale)
                  const socialValues: Partial<Record<keyof SocialLinks, string>> = {
                    wechat,
                    xiaohongshu,
                    officialAccount,
                    bilibili,
                    figma,
                    youshe,
                    x,
                    github,
                    email,
                  }
                  const socialSetters: Partial<Record<keyof SocialLinks, (v: string) => void>> = {
                    wechat: setWechat,
                    xiaohongshu: setXiaohongshu,
                    officialAccount: setOfficialAccount,
                    bilibili: setBilibili,
                    figma: setFigma,
                    youshe: setYoushe,
                    x: setX,
                    github: setGithub,
                    email: setEmail,
                  }
                  const currentVal = socialValues[key] ?? ""
                  const setter = socialSetters[key]
                  const isEmail = key === "email"
                  const isText = type === "text" && !isEmail
                  const showQrPreview = isText && isImageUrl(currentVal)

                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{socialLabel}</Label>
                      {isEmail ? (
                        <Input
                          id={key}
                          type="email"
                          placeholder="example@email.com"
                          value={currentVal}
                          onChange={(e) => setter?.(e.target.value)}
                        />
                      ) : isText ? (
                        <>
                          {showQrPreview ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={currentVal}
                                alt={`${socialLabel}${t("二维码", " QR code")}`}
                                className="h-24 w-24 rounded-lg border border-border object-contain"
                              />
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">{t("已上传", "Uploaded ")}{socialLabel}{t("二维码", " QR code")}</p>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                      const input = document.createElement("input")
                                      input.type = "file"
                                      input.accept = "image/*"
                                      input.onchange = () => {
                                        const file = input.files?.[0]
                                        if (!file || !file.type.startsWith("image/")) return
                                        compressImageToDataUrl(file)
                                          .then((dataUrl) => setter?.(dataUrl))
                                          .catch(() => toast.error(t("图片压缩失败", "Image compression failed")))
                                      }
                                      input.click()
                                    }}
                                  >
                                    <i className="ri-refresh-line mr-1" /> {t("更换", "Replace")}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-destructive hover:text-destructive"
                                    onClick={() => setter?.("")}
                                  >
                                    <i className="ri-delete-bin-line mr-1" /> {t("移除", "Remove")}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <Input
                                  id={key}
                                  placeholder={`${socialLabel}${t("号 / 名称", " ID / Name")}`}
                                  value={currentVal}
                                  onChange={(e) => setter?.(e.target.value)}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0"
                                  onClick={() => {
                                    const input = document.createElement("input")
                                    input.type = "file"
                                    input.accept = "image/*"
                                    input.onchange = () => {
                                      const file = input.files?.[0]
                                      if (!file || !file.type.startsWith("image/")) return
                                      compressImageToDataUrl(file)
                                        .then((dataUrl) => setter?.(dataUrl))
                                        .catch(() => toast.error(t("图片压缩失败", "Image compression failed")))
                                    }
                                    input.click()
                                  }}
                                >
                                  <i className="ri-qr-code-line mr-1" /> {t("上传二维码", "Upload QR")}
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t("填写", "Fill ")}{socialLabel}{t("号/名称，或上传二维码图片", " ID/name, or upload QR image")}
                                {key === "wechat" && t("。上传后将同步展示用户赞助邮件内，不填则不显示", ". It will be shown in sponsorship emails if set.")}
                              </p>
                            </>
                          )}
                        </>
                      ) : (
                        <Input
                          id={key}
                          placeholder="https://..."
                          value={currentVal}
                          onChange={(e) => setter?.(e.target.value)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <Button onClick={saveGeneral} disabled={savingGeneral}>
                {savingGeneral ? t("保存中…", "Saving…") : t("保存", "Save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 导航与页面（按页面分组） ==================== */}
        <TabsContent value="navpage" className="space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("导航与页面文案", "Navigation & Page Copy")}</CardTitle>
              <CardDescription>
                {t("按页面分组设置导航名称和页面介绍文案，一次保存全部生效", "Configure navigation labels and page descriptions by section.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-semibold text-foreground">{t("双语基础配置", "Bilingual Basics")}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="defaultLocale">{t("前台默认语言", "Default Frontend Language")}</Label>
                    <Select value={defaultLocale} onValueChange={(v) => setDefaultLocale(v === "en" ? "en" : "zh")}>
                      <SelectTrigger id="defaultLocale">
                        <SelectValue placeholder={t("选择默认语言", "Choose default language")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh">{t("中文", "Chinese")}</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {t("英文字段可分批填写。前台英文页面会优先读取英文内容，缺失时自动回退到默认语言。", "English fields can be filled progressively. Missing values fallback to default language.")}
                  </div>
                </div>
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
              </div>

              <div className="space-y-4 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-semibold text-foreground">{t("前台显示开关", "Frontend Visibility")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("控制首页区块、侧边栏/底部导航，以及对应列表页是否在前台显示。", "Control homepage sections, sidebar/bottom nav, and corresponding list pages on the frontend.")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-black"
                      checked={showWorksDesign}
                      onChange={(e) => setShowWorksDesign(e.target.checked)}
                    />
                    {t("显示设计作品", "Show design works")}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-black"
                      checked={showWorksDev}
                      onChange={(e) => setShowWorksDev(e.target.checked)}
                    />
                    {t("显示开发作品", "Show development works")}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-black"
                      checked={showBlog}
                      onChange={(e) => setShowBlog(e.target.checked)}
                    />
                    {t("显示文章 / 笔记", "Show blog / notes")}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-black"
                      checked={showTutorials}
                      onChange={(e) => setShowTutorials(e.target.checked)}
                    />
                    {t("显示视频教程", "Show tutorials")}
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-black"
                      checked={showLanguageSwitcher}
                      onChange={(e) => setShowLanguageSwitcher(e.target.checked)}
                    />
                    {t("显示语言切换（中 / 英）", "Show language switcher (ZH / EN)")}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("关闭后将隐藏前台中英文切换入口，站点固定为中文。", "When off, the frontend ZH/EN switcher is hidden and the site stays in Chinese.")}
                </p>
              </div>

              {/* 导航排序 */}
              <div className="space-y-4 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-semibold text-foreground">{t("导航排序", "Navigation Order")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("调整侧边栏 / 底部导航中「设计、开发、文章、视频」的显示顺序，「关于」始终在最后。", "Reorder “Design, Development, Blog, Tutorials” in the sidebar / bottom nav. “About” always stays last.")}
                </p>
                <div className="space-y-2">
                  {navOrder.map((key, index) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2"
                    >
                      <span className="text-sm text-foreground">
                        <span className="mr-2 text-xs text-muted-foreground">{index + 1}.</span>
                        {navLabelMap[key]}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={t("上移", "Move up")}
                          disabled={index === 0}
                          onClick={() => moveNav(index, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <i className="ri-arrow-up-s-line text-base" />
                        </button>
                        <button
                          type="button"
                          aria-label={t("下移", "Move down")}
                          disabled={index === navOrder.length - 1}
                          onClick={() => moveNav(index, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <i className="ri-arrow-down-s-line text-base" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 首页 */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("首页", "Homepage")}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="heroGreeting">{t("Hero 第一行（如 Hello,）", "Hero line 1 (e.g. Hello,)")}</Label>
                    <Input
                      id="heroGreeting"
                      placeholder="Hello,"
                      value={contentLocale === "en" ? heroGreetingEn : heroGreeting}
                      onChange={(e) => (contentLocale === "en" ? setHeroGreetingEn(e.target.value) : setHeroGreeting(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="heroPrefix">{t("Hero 第二行前缀（如 I&apos;m）", "Hero line 2 prefix (e.g. I'm)")}</Label>
                    <Input
                      id="heroPrefix"
                      placeholder="I'm "
                      value={contentLocale === "en" ? heroPrefixEn : heroPrefix}
                      onChange={(e) => (contentLocale === "en" ? setHeroPrefixEn(e.target.value) : setHeroPrefix(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroDesc">{t("Hero 介绍（下方长文案）", "Hero description")}</Label>
                  <Textarea
                    id="heroDesc"
                    placeholder="UI/UX Designer & Developer — crafting digital experiences with care."
                    className="min-h-[80px]"
                    value={contentLocale === "en" ? heroDescEn : heroDesc}
                    onChange={(e) => (contentLocale === "en" ? setHeroDescEn(e.target.value) : setHeroDesc(e.target.value))}
                  />
                </div>
              </div>

              <Separator />

              {/* 设计作品 */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("设计作品", "Design Works")}</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="navWorksDesign">{t("导航名称", "Nav Label")}</Label>
                    <Input
                      id="navWorksDesign"
                      value={contentLocale === "en" ? navWorksDesignEn : navWorksDesign}
                      onChange={(e) => (contentLocale === "en" ? setNavWorksDesignEn(e.target.value) : setNavWorksDesign(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="worksDesignDesc">{t("页面介绍", "Page Description")}</Label>
                    <Input
                      id="worksDesignDesc"
                      placeholder={t("精选设计作品，部分支持赞助下载源文件", "Selected design works, some support sponsorship download")}
                      value={contentLocale === "en" ? worksDesignDescEn : worksDesignDesc}
                      onChange={(e) => (contentLocale === "en" ? setWorksDesignDescEn(e.target.value) : setWorksDesignDesc(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverRatioWorksDesign">{t("封面比例", "Cover Ratio")}</Label>
                    <Select value={coverRatioWorksDesign} onValueChange={(v) => setCoverRatioWorksDesign(normalizeCoverRatio(v))}>
                      <SelectTrigger id="coverRatioWorksDesign">
                        <SelectValue placeholder={t("选择比例", "Select ratio")} />
                      </SelectTrigger>
                      <SelectContent>
                        {COVER_RATIO_OPTIONS.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 开发作品 */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("开发作品", "Development Works")}</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="navWorksDev">{t("导航名称", "Nav Label")}</Label>
                    <Input
                      id="navWorksDev"
                      value={contentLocale === "en" ? navWorksDevEn : navWorksDev}
                      onChange={(e) => (contentLocale === "en" ? setNavWorksDevEn(e.target.value) : setNavWorksDev(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="worksDevDesc">{t("页面介绍", "Page Description")}</Label>
                    <Input
                      id="worksDevDesc"
                      placeholder={t("开源项目与开发作品展示", "Open-source projects and development works")}
                      value={contentLocale === "en" ? worksDevDescEn : worksDevDesc}
                      onChange={(e) => (contentLocale === "en" ? setWorksDevDescEn(e.target.value) : setWorksDevDesc(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverRatioWorksDev">{t("封面比例", "Cover Ratio")}</Label>
                    <Select value={coverRatioWorksDev} onValueChange={(v) => setCoverRatioWorksDev(normalizeCoverRatio(v))}>
                      <SelectTrigger id="coverRatioWorksDev">
                        <SelectValue placeholder={t("选择比例", "Select ratio")} />
                      </SelectTrigger>
                      <SelectContent>
                        {COVER_RATIO_OPTIONS.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 文章/笔记 */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("文章 / 笔记", "Blog / Notes")}</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="navBlog">{t("导航名称", "Nav Label")}</Label>
                    <Input
                      id="navBlog"
                      value={contentLocale === "en" ? navBlogEn : navBlog}
                      onChange={(e) => (contentLocale === "en" ? setNavBlogEn(e.target.value) : setNavBlog(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blogDesc">{t("页面介绍", "Page Description")}</Label>
                    <Input
                      id="blogDesc"
                      placeholder={t("分享设计思考、工具技巧与行业见解", "Share design thoughts, tool tips and industry insights")}
                      value={contentLocale === "en" ? blogDescEn : blogDesc}
                      onChange={(e) => (contentLocale === "en" ? setBlogDescEn(e.target.value) : setBlogDesc(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverRatioBlog">{t("封面比例", "Cover Ratio")}</Label>
                    <Select value={coverRatioBlog} onValueChange={(v) => setCoverRatioBlog(normalizeCoverRatio(v))}>
                      <SelectTrigger id="coverRatioBlog">
                        <SelectValue placeholder={t("选择比例", "Select ratio")} />
                      </SelectTrigger>
                      <SelectContent>
                        {COVER_RATIO_OPTIONS.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 视频教程 */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("视频教程", "Tutorials")}</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="navTutorials">{t("导航名称", "Nav Label")}</Label>
                    <Input
                      id="navTutorials"
                      value={contentLocale === "en" ? navTutorialsEn : navTutorials}
                      onChange={(e) =>
                        contentLocale === "en" ? setNavTutorialsEn(e.target.value) : setNavTutorials(e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tutorialsDesc">{t("页面介绍", "Page Description")}</Label>
                    <Input
                      id="tutorialsDesc"
                      placeholder={t("视频类教材合集，包含 B 站、YouTube 等", "Tutorial collection including Bilibili, YouTube, etc.")}
                      value={contentLocale === "en" ? tutorialsDescEn : tutorialsDesc}
                      onChange={(e) =>
                        contentLocale === "en" ? setTutorialsDescEn(e.target.value) : setTutorialsDesc(e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverRatioTutorials">{t("封面比例", "Cover Ratio")}</Label>
                    <Select value={coverRatioTutorials} onValueChange={(v) => setCoverRatioTutorials(normalizeCoverRatio(v))}>
                      <SelectTrigger id="coverRatioTutorials">
                        <SelectValue placeholder={t("选择比例", "Select ratio")} />
                      </SelectTrigger>
                      <SelectContent>
                        {COVER_RATIO_OPTIONS.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 关于 */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground">{t("关于", "About")}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="navAbout">{t("导航名称", "Nav Label")}</Label>
                    <Input
                      id="navAbout"
                      value={contentLocale === "en" ? navAboutEn : navAbout}
                      onChange={(e) => (contentLocale === "en" ? setNavAboutEn(e.target.value) : setNavAbout(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aboutDesc">{t("页面介绍（可选副标题）", "Page Description (optional subtitle)")}</Label>
                    <Input
                      id="aboutDesc"
                      placeholder={t("留空则不显示", "Leave blank to hide")}
                      value={contentLocale === "en" ? aboutDescEn : aboutDesc}
                      onChange={(e) => (contentLocale === "en" ? setAboutDescEn(e.target.value) : setAboutDesc(e.target.value))}
                    />
                  </div>
                </div>
                {/* 简历 / 作品集（链接 + 显隐，与语言无关）*/}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="resumeUrl">{t("简历链接", "Resume URL")}</Label>
                    <Input
                      id="resumeUrl"
                      placeholder="/docs/xxx.pdf"
                      value={resumeUrl}
                      onChange={(e) => setResumeUrl(e.target.value)}
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={showResume}
                        onChange={(e) => setShowResume(e.target.checked)}
                        className="h-4 w-4 rounded border-border accent-foreground"
                      />
                      {t("显示「查看简历」按钮", "Show the “View Resume” button")}
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portfolioUrl">{t("作品集链接", "Portfolio URL")}</Label>
                    <Input
                      id="portfolioUrl"
                      placeholder="https://..."
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={showPortfolio}
                        onChange={(e) => setShowPortfolio(e.target.checked)}
                        className="h-4 w-4 rounded border-border accent-foreground"
                      />
                      {t("显示「查看作品集」按钮", "Show the “View Portfolio” button")}
                    </label>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="aboutWorkTitle">{t("工作经历标题", "Work Experience Title")}</Label>
                    <Input
                      id="aboutWorkTitle"
                      placeholder={contentLocale === "en" ? "Work Experience" : (defaultPageCopy.aboutWorkTitle ?? "")}
                      value={contentLocale === "en" ? aboutWorkTitleEn : aboutWorkTitle}
                      onChange={(e) => (contentLocale === "en" ? setAboutWorkTitleEn(e.target.value) : setAboutWorkTitle(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aboutEducationTitle">{t("学习经历标题", "Education Title")}</Label>
                    <Input
                      id="aboutEducationTitle"
                      placeholder={contentLocale === "en" ? "Education" : (defaultPageCopy.aboutEducationTitle ?? "")}
                      value={contentLocale === "en" ? aboutEducationTitleEn : aboutEducationTitle}
                      onChange={(e) => (contentLocale === "en" ? setAboutEducationTitleEn(e.target.value) : setAboutEducationTitle(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aboutSkillsTitle">{t("技能标题", "Skills Title")}</Label>
                    <Input
                      id="aboutSkillsTitle"
                      placeholder={contentLocale === "en" ? "Skills" : (defaultPageCopy.aboutSkillsTitle ?? "")}
                      value={contentLocale === "en" ? aboutSkillsTitleEn : aboutSkillsTitle}
                      onChange={(e) => (contentLocale === "en" ? setAboutSkillsTitleEn(e.target.value) : setAboutSkillsTitle(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={saveNavAndPage} disabled={savingNavPage}>
                {savingNavPage ? t("保存中…", "Saving…") : t("保存", "Save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 外观主题 ==================== */}
        <TabsContent value="theme" className="space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("基底灰度", "Base Tone")}</CardTitle>
              <CardDescription>
                {t("选择整体灰度基调，影响背景、卡片、边框等中性色", "Choose grayscale tone for background, cards and borders.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3">
                {BASE_PRESETS.map((preset) => {
                  const isActive = preset.id === themeBase
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleThemeBaseChange(preset.id as BaseColorId)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                        isActive
                          ? "border-primary bg-accent shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-accent/50",
                      )}
                    >
                      <div className="grid w-full max-w-[72px] grid-cols-2 gap-1.5">
                        <div
                          className="h-8 rounded-md border border-border/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          style={{ background: preset.light["--background"] }}
                        />
                        <div
                          className="h-8 rounded-md border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          style={{ background: preset.dark["--background"] }}
                        />
                      </div>
                      <span className="text-xs font-medium">{preset.name}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("强调色", "Accent Color")}</CardTitle>
              <CardDescription>
                {t("选择强调色主题，影响按钮、链接、装饰渐变等", "Choose accent theme for buttons, links and gradients.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {ACCENT_PRESETS.map((preset) => {
                  const isActive = preset.id === themeAccent
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleThemeAccentChange(preset.id as AccentColorId)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all",
                        isActive
                          ? "border-primary bg-accent shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-accent/50",
                      )}
                    >
                      {preset.id === "fanmihua" ? (
                        <div
                          className="h-8 w-8 rounded-full border border-border/50"
                          style={{
                            background: `linear-gradient(135deg, ${preset.gradient.join(", ")})`,
                          }}
                        />
                      ) : (
                        <div
                          className="h-8 w-8 rounded-full border border-border/50"
                          style={{ background: preset.preview }}
                        />
                      )}
                      <span className="text-xs font-medium">{preset.name}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("预览", "Preview")}</CardTitle>
              <CardDescription>{t("当前主题效果实时预览", "Live preview of current theme")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 flex-1 rounded-full"
                    style={{ background: "var(--pride-gradient-h)" }}
                  />
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                      key={i}
                      className="h-8 w-8 rounded-lg border border-border/30"
                      style={{ background: `var(--color-pride-${i})` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button size="sm">{t("主按钮", "Primary")}</Button>
                  <Button size="sm" variant="secondary">{t("次要按钮", "Secondary")}</Button>
                  <Button size="sm" variant="outline">{t("边框按钮", "Outline")}</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={saveTheme} disabled={savingTheme}>
            {savingTheme ? t("保存中…", "Saving…") : t("保存主题", "Save Theme")}
          </Button>
        </TabsContent>

        {/* ==================== 关于我 / 头像 ==================== */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("关于内容语言", "About Content Language")}</CardTitle>
              <CardDescription>{t("切换后编辑对应语言的关于页文案与资料。", "Switch to edit about content in the selected language.")}</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("头像", "Avatar")}</CardTitle>
              <CardDescription>{t("用于关于页、首页 Hero 区域展示", "Used in About page and homepage Hero.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {avatar ? (
                <div className="flex items-center gap-4">
                  {avatarPreviewFailed ? (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-destructive/40 bg-destructive/5 text-destructive">
                      <i className="ri-user-unfollow-line text-2xl" />
                    </div>
                  ) : (
                    <img
                      src={avatar}
                      alt={t("头像预览", "Avatar Preview")}
                      className="h-20 w-20 rounded-full border object-cover"
                      onError={() => {
                        setAvatarPreviewFailed(true)
                        toast.error(t("头像文件不可用，请重新上传图片", "Avatar file is unavailable. Please upload again."))
                      }}
                    />
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarFileInputRef.current?.click()}
                    >
                      {t("更换", "Replace")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setAvatar("")
                        setAvatarPreviewFailed(false)
                      }}
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
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    <i className="ri-user-line mr-1.5" />
                    {t("上传头像", "Upload Avatar")}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {t("上传后自动压缩为 512px 以内、JPEG 格式保存。", "Uploaded image is auto-compressed to <=512px JPEG.")}
                  </p>
                </div>
              )}
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file || !file.type.startsWith("image/")) return
                  e.target.value = ""
                  compressImageToDataUrl(file)
                    .then((next) => {
                      setAvatar(next)
                      setAvatarPreviewFailed(false)
                    })
                    .catch(() => toast.error(t("图片压缩失败，请换一张图", "Image compression failed, please try another image.")))
                }}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("关于页左侧信息", "About Left Panel")}</CardTitle>
              <CardDescription>{t("头像下方的主标题与两个标签，用于关于页左侧栏", "Main title and two labels under avatar on About page.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aboutStudioName">{t("品牌 / 工作室名", "Brand / Studio Name")}</Label>
                <Input
                  id="aboutStudioName"
                  placeholder={t("如 Fan's Studio，留空则使用「基本设置」中的网站名称", "e.g. Fan's Studio, leave blank to use site name")}
                  value={profileStudioName}
                  onChange={(e) => setProfileStudioName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aboutPersonalName">{t("个人名称（标签）", "Personal Name (label)")}</Label>
                <Input
                  id="aboutPersonalName"
                  placeholder={t("如 张三", "e.g. Alex")}
                  value={profilePersonalName}
                  onChange={(e) => setProfilePersonalName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aboutPersonalTitle">{t("个人职位（标签）", "Personal Title (label)")}</Label>
                <Input
                  id="aboutPersonalTitle"
                  placeholder={t("如 UI/UX Designer", "e.g. UI/UX Designer")}
                  value={profilePersonalTitle}
                  onChange={(e) => setProfilePersonalTitle(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>{t("关于我", "About Me")}</CardTitle>
              <CardDescription>{t("分模块填写，将显示在前台「关于」页面", "Fill by modules, shown on frontend About page.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>{t("个人介绍", "Introduction")}</Label>
                <MiniEditor
                  value={profileIntro}
                  onChange={setProfileIntro}
                  placeholder={t("介绍你自己、设计理念、联系方式等...", "Introduce yourself, your design philosophy, contact info...")}
                  minHeight="min-h-[140px]"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>{t("工作经历", "Work Experience")}</Label>
                {profileWorkExperience.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-lg border border-border/50 p-4 sm:grid-cols-2"
                  >
                    <Input
                      placeholder={t("公司 / 组织", "Company / Organization")}
                      value={item.company ?? ""}
                      onChange={(e) => {
                        const next = [...profileWorkExperience]
                        next[index] = { ...next[index], company: e.target.value }
                        setProfileWorkExperience(next)
                      }}
                    />
                    <Input
                      placeholder={t("职位", "Role")}
                      value={item.role ?? ""}
                      onChange={(e) => {
                        const next = [...profileWorkExperience]
                        next[index] = { ...next[index], role: e.target.value }
                        setProfileWorkExperience(next)
                      }}
                    />
                    <Input
                      placeholder={t("时间段，如 2020 - 至今", "Period, e.g. 2020 - Present")}
                      value={item.period ?? ""}
                      onChange={(e) => {
                        const next = [...profileWorkExperience]
                        next[index] = { ...next[index], period: e.target.value }
                        setProfileWorkExperience(next)
                      }}
                    />
                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">{t("工作描述（可选）", "Description (optional)")}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() =>
                            setProfileWorkExperience(profileWorkExperience.filter((_, i) => i !== index))
                          }
                        >
                          <i className="ri-delete-bin-line mr-1" /> {t("删除", "Delete")}
                        </Button>
                      </div>
                      <MiniEditor
                        value={item.description ?? ""}
                        onChange={(html) => {
                          const next = [...profileWorkExperience]
                          next[index] = { ...next[index], description: html }
                          setProfileWorkExperience(next)
                        }}
                        placeholder={t("描述你的工作职责、成果...", "Describe responsibilities and outcomes...")}
                        minHeight="min-h-[80px]"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProfileWorkExperience([...profileWorkExperience, { company: "", role: "", period: "", description: "" }])
                  }
                >
                  <i className="ri-add-line mr-1" /> {t("添加工作经历", "Add Work Experience")}
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>{t("学习经历", "Education")}</Label>
                {profileEducation.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 p-4"
                  >
                    <Input
                      placeholder={t("学校", "School")}
                      value={item.school ?? ""}
                      onChange={(e) => {
                        const next = [...profileEducation]
                        next[index] = { ...next[index], school: e.target.value }
                        setProfileEducation(next)
                      }}
                      className="w-full sm:w-48"
                    />
                    <Input
                      placeholder={t("学历 / 专业", "Degree / Major")}
                      value={item.degree ?? ""}
                      onChange={(e) => {
                        const next = [...profileEducation]
                        next[index] = { ...next[index], degree: e.target.value }
                        setProfileEducation(next)
                      }}
                      className="w-full sm:w-40"
                    />
                    <Input
                      placeholder={t("时间段", "Period")}
                      value={item.period ?? ""}
                      onChange={(e) => {
                        const next = [...profileEducation]
                        next[index] = { ...next[index], period: e.target.value }
                        setProfileEducation(next)
                      }}
                      className="w-full sm:w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setProfileEducation(profileEducation.filter((_, i) => i !== index))}
                    >
                      <i className="ri-delete-bin-line" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setProfileEducation([...profileEducation, { school: "", degree: "", period: "" }])
                  }
                >
                  <i className="ri-add-line mr-1" /> {t("添加学习经历", "Add Education")}
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>{t("技能", "Skills")}</Label>
                {profileSkills.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 p-3"
                  >
                    <Input
                      placeholder={t("技能名称", "Skill Name")}
                      value={item.name ?? ""}
                      onChange={(e) => {
                        const next = [...profileSkills]
                        next[index] = { ...next[index], name: e.target.value }
                        setProfileSkills(next)
                      }}
                      className="w-full sm:w-40"
                    />
                    <Input
                      placeholder={t("熟练度（可选）", "Level (optional)")}
                      value={item.level ?? ""}
                      onChange={(e) => {
                        const next = [...profileSkills]
                        next[index] = { ...next[index], level: e.target.value }
                        setProfileSkills(next)
                      }}
                      className="w-full sm:w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setProfileSkills(profileSkills.filter((_, i) => i !== index))}
                    >
                      <i className="ri-delete-bin-line" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProfileSkills([...profileSkills, { name: "", level: "" }])}
                >
                  <i className="ri-add-line mr-1" /> {t("添加技能", "Add Skill")}
                </Button>
              </div>

              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? t("保存中…", "Saving…") : t("保存", "Save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 账户安全 ==================== */}
        <TabsContent value="security" className="space-y-6">
          <ChangePasswordCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** 密码输入框（带显示/隐藏切换眼睛按钮）。 */
function PasswordInput(props: React.ComponentProps<typeof Input> & { value: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <i className={visible ? "ri-eye-off-line" : "ri-eye-line"} />
      </button>
    </div>
  )
}

/** 修改密码卡片组件。 */
function ChangePasswordCard() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleChangePassword() {
    if (!oldPassword.trim()) {
      toast.error(t("请输入当前密码", "Please enter current password"))
      return
    }
    if (newPassword.length < 6) {
      toast.error(t("新密码至少 6 位", "New password must be at least 6 characters"))
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("两次输入的新密码不一致", "New password entries do not match"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/user/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t("修改失败", "Change failed"))
        return
      }
      toast.success(t("密码修改成功", "Password changed successfully"))
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>{t("修改密码", "Change Password")}</CardTitle>
        <CardDescription>{t("修改当前登录账户的密码", "Change password for current account")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label>{t("当前密码", "Current Password")}</Label>
          <PasswordInput
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder={t("请输入当前密码", "Enter current password")}
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>{t("新密码", "New Password")}</Label>
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("至少 6 位", "At least 6 characters")}
          />
          <p className="text-xs text-muted-foreground">{t("密码长度至少 6 位，建议包含字母和数字", "At least 6 characters, include letters and numbers.")}</p>
        </div>
        <div className="space-y-2">
          <Label>{t("确认新密码", "Confirm New Password")}</Label>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("再次输入新密码", "Re-enter new password")}
            onKeyDown={(e) => { if (e.key === "Enter") handleChangePassword() }}
          />
        </div>
        <Button onClick={handleChangePassword} disabled={saving}>
          {saving ? t("保存中…", "Saving…") : t("修改密码", "Change Password")}
        </Button>
      </CardContent>
    </Card>
  )
}
