import prisma from "@/lib/prisma"

export type SettingsRow = {
  id: string
  siteName: string
  defaultLocale: "ZH" | "EN"
  avatar: string | null
  socialLinks: unknown
  about: unknown
  nav: unknown
  navI18n: unknown
  pageCopy: unknown
  pageCopyI18n: unknown
  aiAssistant: unknown
  aiAssistantI18n: unknown
  aiModelConfig: unknown
  theme: unknown
  footer: unknown
  footerI18n: unknown
  updatedAt: Date
}

/** 读取全局设置单行（id 固定为 "settings"）。 */
export async function getSettingsRow(): Promise<SettingsRow | null> {
  const row = await prisma.settings.findUnique({
    where: { id: "settings" },
  })
  return row as SettingsRow | null
}
