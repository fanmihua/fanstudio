import { DEFAULT_LOCALE, type I18nObject, type I18nText, type Locale, mergeI18nObject, mergeI18nText, resolveI18nObject, resolveI18nText } from "@/lib/i18n"

export function normalizeI18nTextInput(raw: unknown): I18nText {
  if (!raw || typeof raw !== "object") return { zh: null, en: null }
  const obj = raw as Record<string, unknown>
  const zh = typeof obj.zh === "string" ? obj.zh : null
  const en = typeof obj.en === "string" ? obj.en : null
  return { zh, en }
}

export function resolveWithFallbackText(
  raw: unknown,
  locale: Locale,
  defaultLocale: Locale = DEFAULT_LOCALE,
): string {
  return resolveI18nText(normalizeI18nTextInput(raw), locale, defaultLocale)
}

export function resolveWithFallbackObject<T>(
  raw: unknown,
  locale: Locale,
  defaultLocale: Locale = DEFAULT_LOCALE,
): T | null {
  if (!raw || typeof raw !== "object") return null
  return resolveI18nObject(raw as I18nObject<T>, locale, defaultLocale)
}

export function patchI18nText(previous: unknown, patch: unknown): I18nText {
  return mergeI18nText(normalizeI18nTextInput(previous), normalizeI18nTextInput(patch))
}

export function patchI18nObject<T>(previous: unknown, patch: unknown): I18nObject<T> {
  const base = previous && typeof previous === "object" ? (previous as I18nObject<T>) : undefined
  const next = patch && typeof patch === "object" ? (patch as I18nObject<T>) : undefined
  return mergeI18nObject(base, next)
}

export function toI18nText(zhValue: string | null | undefined, enValue: string | null | undefined = null): I18nText {
  return {
    zh: zhValue ?? null,
    en: enValue ?? null,
  }
}

export function toI18nObject<T>(zhValue: T | null | undefined, enValue: T | null | undefined = null): I18nObject<T> {
  return {
    zh: zhValue ?? null,
    en: enValue ?? null,
  }
}
