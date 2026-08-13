/**
 * GET: 返回网站设置（nav、pageCopy 与默认值合并；无记录时返回默认）。
 * PATCH: 更新网站设置，需登录。
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import { getSettingsRow } from "@/lib/settings-db"
import { convertBase64Images, saveDataUrlAsFile } from "@/lib/media-storage"
import { defaultNav, type NavConfig } from "@/lib/nav-config"
import { defaultPageCopy, defaultPersonalName, defaultSiteName, normalizeSiteName, type PageCopy } from "@/lib/page-copy"
import { defaultFooter, type FooterConfig } from "@/lib/version"
import { safeSyncKnowledgeSource } from "@/lib/ai/knowledge-trigger"
import { defaultAIAssistantConfig, normalizeAIAssistantConfig, type AIAssistantConfig } from "@/lib/ai-assistant-config"
import { DEFAULT_LOCALE, fromPrismaLocale, isLocale, LOCALE_COOKIE_KEY, normalizeLocale, type I18nObject, type Locale } from "@/lib/i18n"
import { patchI18nObject, resolveWithFallbackObject } from "@/lib/i18n-content"
import { safeRunMediaCleanupCycle } from "@/lib/media-cleanup"

export const dynamic = "force-dynamic"

function hasSettingsField(fieldName: string): boolean {
  const runtimeModel = (prisma as unknown as {
    _runtimeDataModel?: { models?: Record<string, { fields?: Array<{ name: string }> }> }
  })._runtimeDataModel
  const fields = runtimeModel?.models?.Settings?.fields
  if (!Array.isArray(fields)) return true
  return fields.some((field) => field.name === fieldName)
}

async function convertSettingsImages(value: unknown): Promise<unknown> {
  if (typeof value === "string") {
    return saveDataUrlAsFile(value, "ABOUT", "site")
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) out.push(await convertSettingsImages(item))
    return out
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] =
        key === "siteFavicon" && typeof item === "string"
          ? await saveDataUrlAsFile(item, "ABOUT", "site", {
              imageFormat: "png",
              maxDimension: 256,
            })
          : await convertSettingsImages(item)
    }
    return out
  }
  return value
}

function mergeSettingsWithDefaults(
  row: {
    about?: unknown
    nav?: unknown
    navI18n?: unknown
    pageCopy?: unknown
    pageCopyI18n?: unknown
    footer?: unknown
    footerI18n?: unknown
    aiAssistant?: unknown
    aiAssistantI18n?: unknown
    defaultLocale?: "ZH" | "EN"
  } | Record<string, unknown> | null,
  locale: Locale,
) {
  const defaultLocale = fromPrismaLocale((row?.defaultLocale as "ZH" | "EN" | undefined) ?? "ZH")
  const aboutRaw = row?.about
  const aboutI18nObject =
    aboutRaw && typeof aboutRaw === "object" && ("zh" in (aboutRaw as Record<string, unknown>) || "en" in (aboutRaw as Record<string, unknown>))
      ? (aboutRaw as I18nObject<Record<string, unknown>>)
      : {
          zh: aboutRaw && typeof aboutRaw === "object" ? (aboutRaw as Record<string, unknown>) : null,
          en: null,
        }
  const localizedAbout =
    resolveWithFallbackObject<Record<string, unknown>>(aboutI18nObject, locale, defaultLocale) ??
    { profileCard: { personalName: defaultPersonalName } }
  const localizedNav =
    resolveWithFallbackObject<NavConfig>((row as { navI18n?: unknown } | null)?.navI18n, locale, defaultLocale) ??
    (row?.nav && typeof row.nav === "object" ? (row.nav as NavConfig) : {})
  const nav: NavConfig = {
    ...defaultNav,
    ...localizedNav,
  }
  const localizedPageCopy =
    resolveWithFallbackObject<PageCopy>((row as { pageCopyI18n?: unknown } | null)?.pageCopyI18n, locale, defaultLocale) ??
    {}
  const basePageCopy =
    row?.pageCopy && typeof row.pageCopy === "object" ? (row.pageCopy as PageCopy) : {}
  const pageCopy: PageCopy = {
    ...defaultPageCopy,
    ...basePageCopy,
    ...localizedPageCopy,
  }
  const localizedFooter =
    resolveWithFallbackObject<FooterConfig>((row as { footerI18n?: unknown } | null)?.footerI18n, locale, defaultLocale) ??
    (row?.footer && typeof row.footer === "object" ? (row.footer as FooterConfig) : {})
  const footer: FooterConfig = {
    ...defaultFooter,
    ...localizedFooter,
  }
  const localizedAssistant =
    resolveWithFallbackObject<AIAssistantConfig>(
      (row as { aiAssistantI18n?: unknown } | null)?.aiAssistantI18n,
      locale,
      defaultLocale,
    ) ?? row?.aiAssistant
  const aiAssistant: AIAssistantConfig = normalizeAIAssistantConfig(localizedAssistant)
  return { about: localizedAbout, aboutI18n: aboutI18nObject, nav, pageCopy, footer, aiAssistant, defaultLocale }
}

export async function GET(request: NextRequest) {
  try {
    const localeParam = new URL(request.url).searchParams.get("locale")
    const locale = isLocale(localeParam)
      ? localeParam
      : normalizeLocale(request.cookies.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE)
    const settings = await getSettingsRow()
    if (!settings) {
      const { about, aboutI18n, nav, pageCopy, footer, aiAssistant } = mergeSettingsWithDefaults(null, locale)
      nav.logoText = defaultSiteName
      return NextResponse.json({
        siteName: defaultSiteName,
        locale,
        defaultLocale: DEFAULT_LOCALE,
        avatar: null,
        socialLinks: null,
        about,
        aboutI18n,
        nav,
        pageCopy,
        footer,
        aiAssistant,
      })
    }
    const { about, aboutI18n, nav, pageCopy, footer, aiAssistant, defaultLocale } = mergeSettingsWithDefaults(settings, locale)
    const siteNameNorm = normalizeSiteName(settings.siteName)
    nav.logoText = siteNameNorm
    // 安全：这是无鉴权的公开端点，绝不能整行回传。aiModelConfig 含明文 apiKey（机密），
    // 必须剔除；前台所需的非敏感模型信息由 /api/ai/models 提供。
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { aiModelConfig: _omitAiModelConfig, ...safeSettings } = settings
    return NextResponse.json({
      ...safeSettings,
      locale,
      defaultLocale,
      siteName: siteNameNorm,
      about,
      aboutI18n,
      nav,
      pageCopy,
      footer,
      aiAssistant,
    }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    })
  } catch (e) {
    console.error("[/api/settings] GET failed:", e)
    return NextResponse.json(
      {
        error: "请求失败",
        // 仅开发环境回传细节，生产不泄露 Prisma/堆栈信息
        detail: process.env.NODE_ENV !== "production" ? (e instanceof Error ? e.message : String(e)) : undefined,
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response
  try {
    const supportsAIAssistant = hasSettingsField("aiAssistant")
    const body = await request.json()
    // 将内联 base64 图片转存为文件 URL，避免被序列化进每页 HTML（头像 / 收款码 / favicon 等）
    if (typeof body.avatar === "string") body.avatar = await saveDataUrlAsFile(body.avatar, "ABOUT", "site")
    if (body.socialLinks && typeof body.socialLinks === "object") body.socialLinks = await convertBase64Images(body.socialLinks, "ABOUT", "site")
    if (body.pageCopy && typeof body.pageCopy === "object") body.pageCopy = await convertSettingsImages(body.pageCopy)
    if (body.pageCopyI18n && typeof body.pageCopyI18n === "object") body.pageCopyI18n = await convertSettingsImages(body.pageCopyI18n)
    const {
      siteName,
      defaultLocale,
      avatar,
      socialLinks,
      about,
      aboutI18n,
      nav,
      navI18n,
      pageCopy,
      pageCopyI18n,
      theme,
      footer,
      footerI18n,
      aiAssistant,
      aiAssistantI18n,
    } = body

    const existing = await prisma.settings.findUnique({
      where: { id: "settings" },
    })

    const updatePayload: Record<string, unknown> = {}
    if (siteName !== undefined) updatePayload.siteName = normalizeSiteName(siteName)
    if (defaultLocale !== undefined) updatePayload.defaultLocale = defaultLocale === "en" ? "EN" : "ZH"
    if (avatar !== undefined) updatePayload.avatar = avatar
    if (socialLinks !== undefined) updatePayload.socialLinks = socialLinks
    if (aboutI18n !== undefined) {
      const existingAboutRaw = existing?.about
      const existingAboutI18n =
        existingAboutRaw && typeof existingAboutRaw === "object" && ("zh" in (existingAboutRaw as Record<string, unknown>) || "en" in (existingAboutRaw as Record<string, unknown>))
          ? (existingAboutRaw as I18nObject<Record<string, unknown>>)
          : {
              zh: existingAboutRaw && typeof existingAboutRaw === "object" ? (existingAboutRaw as Record<string, unknown>) : null,
              en: null,
            }
      updatePayload.about = patchI18nObject<Record<string, unknown>>(existingAboutI18n, aboutI18n)
    } else if (about !== undefined) {
      const existingAboutRaw = existing?.about
      const existingAboutI18n =
        existingAboutRaw && typeof existingAboutRaw === "object" && ("zh" in (existingAboutRaw as Record<string, unknown>) || "en" in (existingAboutRaw as Record<string, unknown>))
          ? (existingAboutRaw as I18nObject<Record<string, unknown>>)
          : {
              zh: existingAboutRaw && typeof existingAboutRaw === "object" ? (existingAboutRaw as Record<string, unknown>) : null,
              en: null,
            }
      const writeLocale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE
      updatePayload.about = {
        ...existingAboutI18n,
        [writeLocale]: typeof about === "object" && about ? about : null,
      }
    }
    if (nav !== undefined) updatePayload.nav = nav
    if (navI18n !== undefined) {
      updatePayload.navI18n = patchI18nObject<NavConfig>(existing?.navI18n, navI18n)
    }
    if (pageCopy !== undefined) {
      const existingPageCopy = existing?.pageCopy && typeof existing.pageCopy === "object"
        ? (existing.pageCopy as Record<string, unknown>)
        : {}
      updatePayload.pageCopy = { ...existingPageCopy, ...pageCopy }
    }
    if (pageCopyI18n !== undefined) {
      updatePayload.pageCopyI18n = patchI18nObject<PageCopy>(existing?.pageCopyI18n, pageCopyI18n)
    }
    if (theme !== undefined) updatePayload.theme = theme
    if (footer !== undefined) updatePayload.footer = footer
    if (footerI18n !== undefined) {
      updatePayload.footerI18n = patchI18nObject<FooterConfig>(existing?.footerI18n, footerI18n)
    }
    if (aiAssistant !== undefined && supportsAIAssistant) {
      const existingAssistant = existing?.aiAssistant && typeof existing.aiAssistant === "object"
        ? (existing.aiAssistant as Record<string, unknown>)
        : defaultAIAssistantConfig
      updatePayload.aiAssistant = normalizeAIAssistantConfig({
        ...existingAssistant,
        ...(typeof aiAssistant === "object" && aiAssistant ? aiAssistant : {}),
      })
    }
    if (aiAssistantI18n !== undefined && supportsAIAssistant) {
      const merged = patchI18nObject<AIAssistantConfig>(existing?.aiAssistantI18n, aiAssistantI18n)
      updatePayload.aiAssistantI18n = {
        zh: normalizeAIAssistantConfig((merged as I18nObject<AIAssistantConfig>).zh),
        en: normalizeAIAssistantConfig((merged as I18nObject<AIAssistantConfig>).en),
      }
    }

    if (existing) {
      const updateData: Record<string, unknown> = {}
      if (updatePayload.siteName !== undefined) updateData.siteName = updatePayload.siteName
      if (updatePayload.defaultLocale !== undefined) updateData.defaultLocale = updatePayload.defaultLocale
      if (updatePayload.avatar !== undefined) updateData.avatar = updatePayload.avatar
      if (updatePayload.socialLinks !== undefined) updateData.socialLinks = updatePayload.socialLinks
      if (updatePayload.about !== undefined) updateData.about = updatePayload.about
      if (updatePayload.nav !== undefined) updateData.nav = updatePayload.nav
      if (updatePayload.navI18n !== undefined) updateData.navI18n = updatePayload.navI18n
      if (updatePayload.pageCopy !== undefined) updateData.pageCopy = updatePayload.pageCopy
      if (updatePayload.pageCopyI18n !== undefined) updateData.pageCopyI18n = updatePayload.pageCopyI18n
      if (updatePayload.theme !== undefined) updateData.theme = updatePayload.theme
      if (updatePayload.footer !== undefined) updateData.footer = updatePayload.footer
      if (updatePayload.footerI18n !== undefined) updateData.footerI18n = updatePayload.footerI18n
      if (updatePayload.aiAssistant !== undefined) updateData.aiAssistant = updatePayload.aiAssistant
      if (updatePayload.aiAssistantI18n !== undefined) updateData.aiAssistantI18n = updatePayload.aiAssistantI18n
      if (Object.keys(updateData).length > 0) {
        await prisma.settings.update({
          where: { id: "settings" },
          data: updateData as Parameters<typeof prisma.settings.update>[0]["data"],
        })
      }
      const merged = { ...existing, ...updatePayload }
      const locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE
      const {
        about: mergedAbout,
        aboutI18n: mergedAboutI18n,
        nav: mergedNav,
        pageCopy: mergedPageCopy,
        footer: mergedFooter,
        aiAssistant: mergedAssistant,
        defaultLocale: resolvedDefaultLocale,
      } =
        mergeSettingsWithDefaults(merged, locale)
      await safeSyncKnowledgeSource("SETTINGS", "settings")
      await safeRunMediaCleanupCycle("settings:update")
      return NextResponse.json({
        ...merged,
        locale,
        defaultLocale: resolvedDefaultLocale,
        siteName: normalizeSiteName(merged.siteName as string),
        about: mergedAbout,
        aboutI18n: mergedAboutI18n,
        nav: mergedNav,
        pageCopy: mergedPageCopy,
        footer: mergedFooter,
        aiAssistant: mergedAssistant,
        warning: supportsAIAssistant ? undefined : "当前 Prisma Client 未包含 aiAssistant 字段，文案配置未持久化。请执行 prisma generate 并重启服务。",
      })
    }

    await prisma.settings.create({
      data: {
        id: "settings",
        siteName: normalizeSiteName(siteName),
        defaultLocale: defaultLocale === "en" ? "EN" : "ZH",
        avatar: avatar ?? null,
        socialLinks: socialLinks ?? null,
        about:
          aboutI18n ??
          (about !== undefined
            ? {
                zh: typeof about === "object" && about ? about : null,
                en: null,
              }
            : null),
        nav: nav ?? undefined,
        navI18n: navI18n ?? undefined,
        pageCopy: pageCopy ?? undefined,
        pageCopyI18n: pageCopyI18n ?? undefined,
        ...(supportsAIAssistant ? { aiAssistant: normalizeAIAssistantConfig(aiAssistant) } : {}),
        ...(supportsAIAssistant ? { aiAssistantI18n: aiAssistantI18n ?? undefined } : {}),
        theme: theme ?? undefined,
        footer: footer ?? undefined,
        footerI18n: footerI18n ?? undefined,
      },
    })
    const locale = isLocale(body.locale) ? body.locale : DEFAULT_LOCALE
    const {
      about: mergedAbout,
      aboutI18n: mergedAboutI18n,
      nav: mergedNav,
      pageCopy: mergedPageCopy,
      footer: mergedFooter,
      aiAssistant: mergedAssistant,
    } = mergeSettingsWithDefaults(
      {
        about:
          aboutI18n ??
          (about !== undefined
            ? {
                zh: typeof about === "object" && about ? about : null,
                en: null,
              }
            : null),
        nav,
        navI18n,
        pageCopy,
        pageCopyI18n,
        footer,
        footerI18n,
        aiAssistant,
        aiAssistantI18n,
        defaultLocale: defaultLocale === "en" ? "EN" : "ZH",
      },
      locale,
    )
    await safeSyncKnowledgeSource("SETTINGS", "settings")
    await safeRunMediaCleanupCycle("settings:create")
    return NextResponse.json({
      id: "settings",
      siteName: normalizeSiteName(siteName),
        avatar: avatar ?? null,
        socialLinks: socialLinks ?? null,
        about: mergedAbout,
        aboutI18n: mergedAboutI18n,
        defaultLocale: defaultLocale === "en" ? "en" : "zh",
        nav: mergedNav,
        pageCopy: mergedPageCopy,
        footer: mergedFooter,
      aiAssistant: mergedAssistant,
      warning: supportsAIAssistant ? undefined : "当前 Prisma Client 未包含 aiAssistant 字段，文案配置未持久化。请执行 prisma generate 并重启服务。",
    })
  } catch (e) {
    const raw = e instanceof Error ? e.message : "保存失败"
    const message = raw.includes("Unknown argument `aiAssistant`")
      ? "Prisma Client 尚未更新，缺少 aiAssistant 字段。请执行 `npx prisma generate` 并重启服务。"
      : raw
    return NextResponse.json(
      { error: "保存失败", detail: message },
      { status: 500 }
    )
  }
}
