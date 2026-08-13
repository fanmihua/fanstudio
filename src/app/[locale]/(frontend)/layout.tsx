import { notFound } from "next/navigation"
import { getFrontendSettings } from "@/lib/settings-server"
import { isLocale, type Locale } from "@/lib/i18n"
import FrontendLayoutClient from "@/app/(frontend)/FrontendLayoutClient"
import type { Metadata } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const initial = await getFrontendSettings(locale)
  const description = initial.pageCopy.siteDescription || ""
  // title 继承根布局（src/app/layout.tsx）的 default + template，避免出现 "站名 | 站名"
  return {
    description,
    alternates: {
      languages: {
        zh: `/zh`,
        en: `/en`,
      },
    },
  }
}

export const dynamic = "force-dynamic"

export default async function LocalizedFrontendLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const initial = await getFrontendSettings(locale as Locale)
  return <FrontendLayoutClient initial={initial}>{children}</FrontendLayoutClient>
}
