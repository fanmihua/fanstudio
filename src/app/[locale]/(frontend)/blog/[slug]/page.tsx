import type { Metadata } from "next"
import { buildBlogPostMetadata, renderBlogPostPage } from "@/app/(frontend)/blog/[slug]/page"
import { normalizeLocale } from "@/lib/i18n"

interface LocaleBlogPostPageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: LocaleBlogPostPageProps): Promise<Metadata> {
  const { locale, slug } = await params
  return buildBlogPostMetadata({ slug, locale: normalizeLocale(locale) })
}

export default async function LocaleBlogPostPage({ params }: LocaleBlogPostPageProps) {
  const { locale, slug } = await params
  return renderBlogPostPage({ slug, locale: normalizeLocale(locale) })
}
