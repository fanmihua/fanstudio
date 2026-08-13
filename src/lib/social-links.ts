/**
 * 社交链接配置：顺序、key、展示名称、图标。与后台设置、首页、关于页一致。
 *
 * type:
 *  - "url"  可跳转的链接
 *  - "text" 纯文字/二维码（如微信号、公众号），前台以 Popover 展示
 */
export type SocialLinks = {
  wechat?: string
  xiaohongshu?: string
  officialAccount?: string
  bilibili?: string
  figma?: string
  youshe?: string
  x?: string
  github?: string
  email?: string
  weibo?: string
  dribbble?: string
  behance?: string
}

export type SocialEntryType = "url" | "text"

export type SocialEntry = {
  key: keyof SocialLinks
  label: string
  labelEn?: string
  icon: string
  type: SocialEntryType
}

export const SOCIAL_LINK_ENTRIES: SocialEntry[] = [
  { key: "wechat", label: "微信", labelEn: "WeChat", icon: "ri-wechat-line", type: "text" },
  { key: "xiaohongshu", label: "小红书", labelEn: "REDnote", icon: "ri-book-open-line", type: "url" },
  { key: "officialAccount", label: "公众号", labelEn: "WeChat Official Account", icon: "ri-wechat-2-line", type: "text" },
  { key: "bilibili", label: "B站", labelEn: "bilibili", icon: "ri-bilibili-line", type: "url" },
  { key: "figma", label: "Figma", labelEn: "Figma", icon: "ri-figma-line", type: "url" },
  { key: "youshe", label: "优设", labelEn: "UISDC", icon: "ri-brush-line", type: "url" },
  { key: "x", label: "X", labelEn: "X", icon: "ri-twitter-x-line", type: "url" },
  { key: "github", label: "GitHub", labelEn: "GitHub", icon: "ri-github-line", type: "url" },
  { key: "email", label: "邮箱", labelEn: "Email", icon: "ri-mail-line", type: "text" },
]

/** 兼容旧数据：微博、Dribbble、Behance 仍可显示 */
export const LEGACY_SOCIAL_ENTRIES: SocialEntry[] = [
  { key: "weibo", label: "微博", labelEn: "Weibo", icon: "ri-weibo-line", type: "url" },
  { key: "dribbble", label: "Dribbble", labelEn: "Dribbble", icon: "ri-dribbble-line", type: "url" },
  { key: "behance", label: "Behance", labelEn: "Behance", icon: "ri-behance-line", type: "url" },
]

/** 首页/关于页展示用：先新 8 项再兼容旧 3 项，有值的才展示 */
export const ALL_SOCIAL_ENTRIES = [...SOCIAL_LINK_ENTRIES, ...LEGACY_SOCIAL_ENTRIES]

export function getSocialEntryLabel(entry: SocialEntry, locale: "zh" | "en" = "zh"): string {
  return locale === "en" ? entry.labelEn ?? entry.label : entry.label
}

export function normalizeSocialUrl(url: string): string {
  const trimmed = (url ?? "").trim()
  if (!trimmed) return ""
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
}

/** 判断值是否为图片（data URL 或常见图片后缀） */
export function isImageUrl(value: string): boolean {
  const trimmed = (value ?? "").trim()
  if (!trimmed) return false
  // data:image/ 开头的 base64 图片
  if (trimmed.startsWith("data:image/")) return true
  // 常见图片后缀（忽略查询参数）
  const pathname = trimmed.toLowerCase().split("?")[0]
  return /\.(jpg|jpeg|png|gif|webp|svg)$/.test(pathname)
}
