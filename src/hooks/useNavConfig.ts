"use client"

import { useState, useEffect } from "react"
import { defaultNav, type NavConfig } from "@/lib/nav-config"
import { defaultPageCopy, type PageCopy } from "@/lib/page-copy"
import { useFrontendSettingsContext } from "@/contexts/FrontendSettingsContext"
import { detectLocaleFromPath } from "@/lib/i18n-path"

export type FrontendSettings = {
  nav: NavConfig
  pageCopy: PageCopy
  siteName?: string | null
  socialLinks?: import("@/lib/social-links").SocialLinks | null
  locale: import("@/lib/i18n").Locale
  defaultLocale: import("@/lib/i18n").Locale
}

export function useNavConfig(): FrontendSettings {
  const context = useFrontendSettingsContext()
  const [fallback, setFallback] = useState<FrontendSettings>({
    nav: defaultNav,
    pageCopy: defaultPageCopy,
    siteName: null,
    socialLinks: null,
    locale: "zh",
    defaultLocale: "zh",
  })

  useEffect(() => {
    if (context) return
    const locale = typeof window !== "undefined" ? detectLocaleFromPath(window.location.pathname) : fallback.locale
    fetch(`/api/settings?locale=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        const n = data.nav
        const copy = data.pageCopy
        const socialLinks =
          data.socialLinks && typeof data.socialLinks === "object"
            ? data.socialLinks
            : null
        setFallback({
          nav: n && typeof n === "object" ? { ...defaultNav, ...n } : defaultNav,
          pageCopy:
            copy && typeof copy === "object"
              ? { ...defaultPageCopy, ...copy }
              : defaultPageCopy,
          siteName: data.siteName ?? null,
          socialLinks,
          locale: data.locale === "en" ? "en" : locale,
          defaultLocale: data.defaultLocale === "en" ? "en" : "zh",
        })
      })
      .catch(() => {})
  }, [context, fallback.locale])

  return context ?? fallback
}
