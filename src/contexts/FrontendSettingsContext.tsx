"use client"

import { createContext, useContext, useState, useEffect, useMemo } from "react"
import type { FrontendSettings } from "@/lib/settings-server"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy } from "@/lib/page-copy"

const FrontendSettingsContext = createContext<FrontendSettings | null>(null)

export function FrontendSettingsProvider({
  initial,
  children,
}: {
  initial: FrontendSettings
  children: React.ReactNode
}) {
  const [value, setValue] = useState<FrontendSettings>(initial)

  useEffect(() => {
    fetch(`/api/settings?locale=${value.locale}`)
      .then((r) => r.json())
      .then((data) => {
        const n = data.nav
        const copy = data.pageCopy
        const siteName = data.siteName
        const socialLinks = data.socialLinks
        const footer = data.footer
        setValue((prev) => ({
          ...prev,
          ...(n && typeof n === "object" ? { nav: { ...defaultNav, ...n } } : {}),
          ...(copy && typeof copy === "object"
            ? { pageCopy: { ...defaultPageCopy, ...copy } }
            : {}),
          ...(siteName !== undefined ? { siteName } : {}),
          ...(socialLinks !== undefined && socialLinks !== null ? { socialLinks } : {}),
          ...(footer && typeof footer === "object" ? { footer } : {}),
        }))
      })
      .catch(() => {})
  }, [value.locale])

  const memo = useMemo(() => value, [value])
  return (
    <FrontendSettingsContext.Provider value={memo}>
      {children}
    </FrontendSettingsContext.Provider>
  )
}

export function useFrontendSettingsContext(): FrontendSettings | null {
  return useContext(FrontendSettingsContext)
}
