import { getSettingsRow } from "@/lib/settings-db"
import { defaultNav, type NavConfig } from "@/lib/nav-config"
import { defaultPageCopy, normalizeSiteName, type PageCopy } from "@/lib/page-copy"
import type { SocialLinks } from "@/lib/social-links"
import { DEFAULT_THEME, type ThemeConfig } from "@/lib/theme-presets"
import { defaultFooter, type FooterConfig } from "@/lib/version"
import { fromPrismaLocale, type Locale } from "@/lib/i18n"
import { resolveWithFallbackObject } from "@/lib/i18n-content"
import { normalizeAIAssistantConfig, type AIAssistantConfig } from "@/lib/ai-assistant-config"

export type FrontendSettings = {
  nav: NavConfig
  pageCopy: PageCopy
  siteName?: string | null
  socialLinks?: SocialLinks | null
  footer: FooterConfig
  aiAssistant: AIAssistantConfig
  theme: ThemeConfig
  locale: Locale
  defaultLocale: Locale
}

/** 服务端获取前台所需配置（nav、pageCopy、siteName、socialLinks），供 layout 首屏注入。 */
export async function getFrontendSettings(locale: Locale = "zh"): Promise<FrontendSettings> {
  const row = await getSettingsRow()
  const defaultLocale = fromPrismaLocale(row?.defaultLocale)
  const localizedNav =
    resolveWithFallbackObject<NavConfig>(row?.navI18n, locale, defaultLocale) ??
    (row?.nav as NavConfig | null)
  const nav: NavConfig = {
    ...defaultNav,
    ...(localizedNav && typeof localizedNav === "object" ? localizedNav : {}),
  }
  const localizedPageCopy =
    resolveWithFallbackObject<PageCopy>(row?.pageCopyI18n, locale, defaultLocale) ??
    null
  const basePageCopy =
    row?.pageCopy && typeof row.pageCopy === "object"
      ? (row.pageCopy as PageCopy)
      : null
  const pageCopy: PageCopy = {
    ...defaultPageCopy,
    ...(basePageCopy && typeof basePageCopy === "object" ? basePageCopy : {}),
    ...(localizedPageCopy && typeof localizedPageCopy === "object" ? localizedPageCopy : {}),
  }
  const siteName = normalizeSiteName(row?.siteName)
  nav.logoText = siteName
  const socialLinks =
    row?.socialLinks && typeof row.socialLinks === "object"
      ? (row.socialLinks as SocialLinks)
      : null
  const localizedFooter =
    resolveWithFallbackObject<FooterConfig>(row?.footerI18n, locale, defaultLocale) ??
    (row?.footer && typeof row.footer === "object" ? (row.footer as FooterConfig) : {})
  const footer: FooterConfig = {
    ...defaultFooter,
    ...localizedFooter,
  }
  const localizedAssistant =
    resolveWithFallbackObject<AIAssistantConfig>(row?.aiAssistantI18n, locale, defaultLocale) ??
    row?.aiAssistant
  const aiAssistant = normalizeAIAssistantConfig(localizedAssistant)
  const theme: ThemeConfig =
    row?.theme && typeof row.theme === "object"
      ? { ...DEFAULT_THEME, ...(row.theme as Partial<ThemeConfig>) }
      : DEFAULT_THEME
  return { nav, pageCopy, siteName, socialLinks, footer, aiAssistant, theme, locale, defaultLocale }
}
