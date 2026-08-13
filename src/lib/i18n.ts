export const SUPPORTED_LOCALES = ["zh", "en"] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type PrismaLocale = "ZH" | "EN"

export const DEFAULT_LOCALE: Locale = "zh"
export const LOCALE_COOKIE_KEY = "fanstudio-locale"

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && SUPPORTED_LOCALES.includes(value as Locale)
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export function toPrismaLocale(locale: Locale): PrismaLocale {
  return locale === "en" ? "EN" : "ZH"
}

export function fromPrismaLocale(locale: PrismaLocale | null | undefined): Locale {
  return locale === "EN" ? "en" : "zh"
}

export function oppositeLocale(locale: Locale): Locale {
  return locale === "zh" ? "en" : "zh"
}

export type I18nText = {
  zh?: string | null
  en?: string | null
}

export type I18nObject<T> = {
  zh?: T | null
  en?: T | null
}

export function resolveI18nText(
  input: I18nText | null | undefined,
  locale: Locale,
  defaultLocale: Locale = DEFAULT_LOCALE,
): string {
  const preferred = (input?.[locale] || "").trim()
  if (preferred) return preferred
  const fallback = (input?.[defaultLocale] || "").trim()
  if (fallback) return fallback
  const zh = (input?.zh || "").trim()
  if (zh) return zh
  const en = (input?.en || "").trim()
  if (en) return en
  return ""
}

export function mergeI18nText(
  previous: I18nText | null | undefined,
  patch: Partial<I18nText> | null | undefined,
): I18nText {
  return {
    zh: patch?.zh !== undefined ? patch.zh : previous?.zh ?? null,
    en: patch?.en !== undefined ? patch.en : previous?.en ?? null,
  }
}

export function resolveI18nObject<T>(
  input: I18nObject<T> | null | undefined,
  locale: Locale,
  defaultLocale: Locale = DEFAULT_LOCALE,
): T | null {
  if (!input) return null
  const preferred = input[locale]
  if (preferred != null) return preferred
  const fallback = input[defaultLocale]
  if (fallback != null) return fallback
  if (input.zh != null) return input.zh
  if (input.en != null) return input.en
  return null
}

export function mergeI18nObject<T>(
  previous: I18nObject<T> | null | undefined,
  patch: Partial<I18nObject<T>> | null | undefined,
): I18nObject<T> {
  return {
    zh: patch?.zh !== undefined ? patch.zh : previous?.zh ?? null,
    en: patch?.en !== undefined ? patch.en : previous?.en ?? null,
  }
}

export type I18nDict = Record<string, string>

export function t(dict: I18nDict, key: string, fallback: string = ""): string {
  return dict[key] ?? fallback
}
