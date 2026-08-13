/** 通用工具：cn 合并 class、getBaseUrl 取站点根地址。 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const DEFAULT_PUBLIC_SITE_URL = "https://example.com"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function normalizePublicUrl(value: string | undefined): string {
  const url = value?.trim().replace(/\/+$/, "")
  if (!url) return ""
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) return ""
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url)) return `https://${url}`
  return url
}

export function getPublicSiteUrl(): string {
  const domain = normalizePublicUrl(process.env.NEXT_PUBLIC_SITE_DOMAIN)
  return (
    normalizePublicUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizePublicUrl(process.env.AUTH_URL) ||
    normalizePublicUrl(process.env.NEXTAUTH_URL) ||
    (domain ? domain : "") ||
    DEFAULT_PUBLIC_SITE_URL
  )
}

/** 服务端请求 API 时使用的站点根地址 */
export function getBaseUrl(): string {
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return getPublicSiteUrl()
}
