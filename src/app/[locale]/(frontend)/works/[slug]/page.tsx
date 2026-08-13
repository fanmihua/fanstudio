import { renderWorkDetailPage } from "@/app/(frontend)/works/[slug]/page"
import { isLocale } from "@/lib/i18n"
import { notFound } from "next/navigation"

export default async function LocalizedWorkDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  return renderWorkDetailPage({ slug, locale })
}
