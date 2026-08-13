"use client"

import { useCallback, useEffect, useState } from "react"
import { isLocale, type Locale } from "@/lib/i18n"

const STORAGE_KEY = "admin-ui-locale"

export function useUiLocale(defaultLocale: Locale = "zh") {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    return isLocale(stored) ? stored : defaultLocale
  })

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next)
      document.documentElement.lang = next
    }
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(locale === "zh" ? "en" : "zh")
  }, [locale, setLocale])

  return { locale, setLocale, toggleLocale }
}
