import type { MetadataRoute } from "next"
import prisma from "@/lib/prisma"
import { getPublicSiteUrl } from "@/lib/utils"

// 内容来自数据库；在请求时生成，避免全新安装尚未启动 MySQL 时阻塞 next build。
export const dynamic = "force-dynamic"
export const revalidate = 0

const BASE_URL = getPublicSiteUrl()

const STATIC_PATHS = ["", "/about", "/blog", "/works/design", "/works/development", "/tutorials"]

function localizedSlug(raw: unknown, locale: "zh" | "en", fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback
  const value = (raw as Record<string, unknown>)[locale]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, works, tutorials] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, slugI18n: true, updatedAt: true },
    }),
    prisma.work.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.videoTutorial.findMany({ select: { slug: true, updatedAt: true } }),
  ])

  const items: MetadataRoute.Sitemap = []

  for (const locale of ["zh", "en"] as const) {
    for (const path of STATIC_PATHS) {
      items.push({
        url: `${BASE_URL}/${locale}${path}`,
        lastModified: new Date(),
      })
    }

    for (const row of posts) {
      items.push({
        url: `${BASE_URL}/${locale}/blog/${localizedSlug(row.slugI18n, locale, row.slug)}`,
        lastModified: row.updatedAt,
      })
    }

    for (const row of works) {
      items.push({
        url: `${BASE_URL}/${locale}/works/${row.slug}`,
        lastModified: row.updatedAt,
      })
    }

    for (const row of tutorials) {
      items.push({
        url: `${BASE_URL}/${locale}/tutorials#${row.slug}`,
        lastModified: row.updatedAt,
      })
    }
  }

  return items
}
