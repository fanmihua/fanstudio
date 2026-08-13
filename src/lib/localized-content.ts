import type { Locale } from "@/lib/i18n"
import { toI18nObject, toI18nText } from "@/lib/i18n-content"
import { DEFAULT_LOCALE, resolveI18nObject, resolveI18nText } from "@/lib/i18n"

function localeText(obj: unknown, locale: Locale, fallback: Locale): string | null {
  if (!obj || typeof obj !== "object") return null
  const value = resolveI18nText(obj as { zh?: string | null; en?: string | null }, locale, fallback)
  return value || null
}

function localeObj<T>(obj: unknown, locale: Locale, fallback: Locale): T | null {
  if (!obj || typeof obj !== "object") return null
  return resolveI18nObject(obj as { zh?: T | null; en?: T | null }, locale, fallback)
}

function resolveTextWithLegacy(
  i18nValue: unknown,
  legacyValue: string | null | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): string | null {
  if (i18nValue && typeof i18nValue === "object") {
    const exact = ((i18nValue as { [key: string]: unknown })[locale] ?? "") as string | null
    if (typeof exact === "string" && exact.trim()) return exact.trim()
  }
  if (typeof legacyValue === "string" && legacyValue.trim()) return legacyValue.trim()
  return localeText(i18nValue, locale, fallback)
}

function resolveObjectWithLegacy<T>(
  i18nValue: unknown,
  legacyValue: T | null | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): T | null {
  if (i18nValue && typeof i18nValue === "object") {
    const exact = (i18nValue as { [key: string]: T | null | undefined })[locale]
    if (exact != null) return exact
  }
  if (legacyValue != null) return legacyValue
  return localeObj<T>(i18nValue, locale, fallback)
}

/** 正文是否为可渲染内容：非空 BlockNote 数组或非空对象。空对象 {}（创建时残留的空壳）视为无内容。 */
function hasRenderableContent(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false
  if (Array.isArray(value)) return value.length > 0
  return Object.keys(value as object).length > 0
}

function resolveRenderableContentWithLegacy<T>(
  i18nValue: unknown,
  legacyValue: T | null | undefined,
  locale: Locale,
  fallback: Locale = DEFAULT_LOCALE,
): T | null {
  if (i18nValue && typeof i18nValue === "object") {
    const exact = (i18nValue as { [key: string]: T | null | undefined })[locale]
    if (hasRenderableContent(exact)) return exact ?? null
  }
  if (hasRenderableContent(legacyValue)) return legacyValue ?? null
  return resolveObjectWithLegacy(i18nValue, legacyValue, locale, fallback)
}

export function localizePost<T extends Record<string, unknown>>(row: T, locale: Locale, fallback: Locale): T {
  return {
    ...row,
    title: resolveTextWithLegacy(row.titleI18n, row.title as string, locale, fallback) ?? (row.title as string),
    slug: resolveTextWithLegacy(row.slugI18n, row.slug as string, locale, fallback) ?? (row.slug as string),
    excerpt: resolveTextWithLegacy(row.excerptI18n, row.excerpt as string | null, locale, fallback) ?? (row.excerpt as string | null),
    content: resolveRenderableContentWithLegacy(row.contentI18n, row.content, locale, fallback) ?? row.content,
    category:
      row.category && typeof row.category === "object"
        ? localizeCategory(row.category as Record<string, unknown>, locale, fallback)
        : row.category,
    tags: Array.isArray(row.tags)
      ? row.tags.map((tag) =>
          tag && typeof tag === "object"
            ? localizeTag(tag as Record<string, unknown>, locale, fallback)
            : tag,
        )
      : row.tags,
  }
}

export function localizeWork<T extends Record<string, unknown>>(row: T, locale: Locale, fallback: Locale): T {
  return {
    ...row,
    title: resolveTextWithLegacy(row.titleI18n, row.title as string, locale, fallback) ?? (row.title as string),
    slug: resolveTextWithLegacy(row.slugI18n, row.slug as string, locale, fallback) ?? (row.slug as string),
    description: resolveTextWithLegacy(row.descriptionI18n, row.description as string | null, locale, fallback) ?? (row.description as string | null),
    content: resolveObjectWithLegacy(row.contentI18n, row.content, locale, fallback) ?? row.content,
    category:
      row.category && typeof row.category === "object"
        ? localizeCategory(row.category as Record<string, unknown>, locale, fallback)
        : row.category,
    tags: Array.isArray(row.tags)
      ? row.tags.map((tag) =>
          tag && typeof tag === "object"
            ? localizeTag(tag as Record<string, unknown>, locale, fallback)
            : tag,
        )
      : row.tags,
  }
}

export function localizeTutorial<T extends Record<string, unknown>>(row: T, locale: Locale, fallback: Locale): T {
  return {
    ...row,
    title: resolveTextWithLegacy(row.titleI18n, row.title as string, locale, fallback) ?? (row.title as string),
    slug: resolveTextWithLegacy(row.slugI18n, row.slug as string, locale, fallback) ?? (row.slug as string),
    description: resolveTextWithLegacy(row.descriptionI18n, row.description as string | null, locale, fallback) ?? (row.description as string | null),
    category:
      row.category && typeof row.category === "object"
        ? localizeCategory(row.category as Record<string, unknown>, locale, fallback)
        : row.category,
    tags: Array.isArray(row.tags)
      ? row.tags.map((tag) =>
          tag && typeof tag === "object"
            ? localizeTag(tag as Record<string, unknown>, locale, fallback)
            : tag,
        )
      : row.tags,
  }
}

export function localizeCategory<T extends Record<string, unknown>>(row: T, locale: Locale, fallback: Locale): T {
  return {
    ...row,
    name: resolveTextWithLegacy(row.nameI18n, row.name as string, locale, fallback) ?? (row.name as string),
    slug: resolveTextWithLegacy(row.slugI18n, row.slug as string, locale, fallback) ?? (row.slug as string),
  }
}

export function localizeTag<T extends Record<string, unknown>>(row: T, locale: Locale, fallback: Locale): T {
  return {
    ...row,
    name: resolveTextWithLegacy(row.nameI18n, row.name as string, locale, fallback) ?? (row.name as string),
  }
}

export function buildPostI18nInput(raw: {
  title?: string
  slug?: string
  excerpt?: string | null
  content?: unknown
  titleI18n?: unknown
  slugI18n?: unknown
  excerptI18n?: unknown
  contentI18n?: unknown
}) {
  return {
    titleI18n: raw.titleI18n ?? toI18nText(raw.title ?? "", null),
    slugI18n: raw.slugI18n ?? toI18nText(raw.slug ?? "", null),
    excerptI18n: raw.excerptI18n ?? toI18nText(raw.excerpt ?? null, null),
    contentI18n: raw.contentI18n ?? toI18nObject(raw.content ?? {}, null),
  }
}

export function buildWorkI18nInput(raw: {
  title?: string
  slug?: string
  description?: string | null
  content?: unknown
  titleI18n?: unknown
  slugI18n?: unknown
  descriptionI18n?: unknown
  contentI18n?: unknown
}) {
  return {
    titleI18n: raw.titleI18n ?? toI18nText(raw.title ?? "", null),
    slugI18n: raw.slugI18n ?? toI18nText(raw.slug ?? "", null),
    descriptionI18n: raw.descriptionI18n ?? toI18nText(raw.description ?? null, null),
    contentI18n: raw.contentI18n ?? toI18nObject(raw.content ?? null, null),
  }
}

export function buildTutorialI18nInput(raw: {
  title?: string
  slug?: string
  description?: string | null
  titleI18n?: unknown
  slugI18n?: unknown
  descriptionI18n?: unknown
}) {
  return {
    titleI18n: raw.titleI18n ?? toI18nText(raw.title ?? "", null),
    slugI18n: raw.slugI18n ?? toI18nText(raw.slug ?? "", null),
    descriptionI18n: raw.descriptionI18n ?? toI18nText(raw.description ?? null, null),
  }
}
