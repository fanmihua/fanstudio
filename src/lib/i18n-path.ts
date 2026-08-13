import { isLocale, type Locale } from "@/lib/i18n"

export function detectLocaleFromPath(pathname: string): Locale {
  const first = pathname.split("/").filter(Boolean)[0]
  if (isLocale(first)) return first
  return "zh"
}

export function stripLocaleFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length > 0 && isLocale(segments[0])) {
    return `/${segments.slice(1).join("/")}` || "/"
  }
  return pathname || "/"
}

export function withLocalePath(pathname: string, locale: Locale): string {
  const raw = stripLocaleFromPath(pathname)
  const normalized = raw.startsWith("/") ? raw : `/${raw}`
  if (normalized === "/") return `/${locale}`
  return `/${locale}${normalized}`
}
