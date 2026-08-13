/** 作品详情页：展示信息与 Figma 嵌入，右侧购买/升级侧栏。 */
import Link from "next/link"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { contentToHtml } from "@/lib/render-content"
import { jsonToPlainText } from "@/lib/content-format"
import { defaultNav } from "@/lib/nav-config"
import { defaultSiteName } from "@/lib/page-copy"
import { getFrontendSettings } from "@/lib/settings-server"
import { DEFAULT_LOCALE, fromPrismaLocale, normalizeLocale, type Locale } from "@/lib/i18n"
import { getLocaleFromCookie } from "@/lib/i18n-server"
import { localizeWork } from "@/lib/localized-content"
import { withLocalePath } from "@/lib/i18n-path"
import { PurchaseSidebar } from "./PurchaseSidebar"
import { ImageGallery } from "@/components/frontend/ImageGallery"

interface WorkDetailPageProps {
  params: Promise<{ slug: string }>
}

type WorkDetailViewProps = {
  slug: string
  locale?: Locale
}

/** 将 Figma 分享链接转换为 embed URL */
function figmaEmbedUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    if (!u.hostname.endsWith("figma.com")) return null
    u.hostname = "embed.figma.com"
    if (!u.searchParams.has("embed-host")) {
      u.searchParams.set("embed-host", process.env.NEXT_PUBLIC_SITE_DOMAIN || "example.com")
    }
    return u.toString()
  } catch {
    return null
  }
}

export default async function WorkDetailPage({ params }: WorkDetailPageProps) {
  const { slug } = await params
  return renderWorkDetailPage({ slug })
}

export async function renderWorkDetailPage({ slug, locale }: WorkDetailViewProps) {
  const resolvedLocale = normalizeLocale(locale ?? await getLocaleFromCookie() ?? DEFAULT_LOCALE)
  const [workRef, settingsRow] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM Work
      WHERE status = 'PUBLISHED'
        AND (
          slug = ${slug}
          OR JSON_UNQUOTE(JSON_EXTRACT(slugI18n, '$.zh')) = ${slug}
          OR JSON_UNQUOTE(JSON_EXTRACT(slugI18n, '$.en')) = ${slug}
        )
      LIMIT 1
    `,
    prisma.settings.findUnique({ where: { id: "settings" }, select: { defaultLocale: true } }),
  ])
  const workId = workRef[0]?.id
  const work = workId
    ? await prisma.work.findUnique({
        where: { id: workId },
        select: {
          id: true,
          title: true,
          slug: true,
          titleI18n: true,
          slugI18n: true,
          workType: true,
          description: true,
          descriptionI18n: true,
          content: true,
          contentI18n: true,
          coverImage: true,
          images: true,
          price: true,
          isFree: true,
          likeCount: true,
          figmaUrl: true,
          deliveryUrl: true,
          demoUrl: true,
          demoQrCode: true,
          currentVersion: true,
          updatedAt: true,
          category: { select: { name: true, slug: true, nameI18n: true, slugI18n: true } },
          tags: { select: { id: true, name: true, nameI18n: true } },
        },
      })
    : null
  if (!work) notFound()

  const downloadCount = await prisma.order.count({ where: { workId: work.id, status: "PAID" } })
  const fallbackLocale = fromPrismaLocale(settingsRow?.defaultLocale)
  const localizedWork = localizeWork(
    {
      ...work,
      price: work.price != null ? Number(work.price) : null,
      images: Array.isArray(work.images) ? work.images : [],
    } as Record<string, unknown>,
    resolvedLocale,
    fallbackLocale,
  )
  const settings = await getFrontendSettings(resolvedLocale)
  const nav = { ...defaultNav, ...settings.nav }
  const isDev = localizedWork.workType === "DEVELOPMENT"
  const sectionLabel = isDev ? (nav.worksDev ?? defaultNav.worksDev) : (nav.worksDesign ?? defaultNav.worksDesign)
  const listHref = withLocalePath(isDev ? "/works/development" : "/works/design", resolvedLocale)
  const homeHref = withLocalePath("/", resolvedLocale)

  const imagesRaw = Array.isArray(localizedWork.images) ? localizedWork.images : []
  const images = imagesRaw.filter((u): u is string => typeof u === "string")
  const categoryName = (localizedWork.category as { name?: string } | null | undefined)?.name ?? ""
  const tags = Array.isArray(localizedWork.tags)
    ? (localizedWork.tags as { id: string; name: string }[])
    : []
  const contentHtml = contentToHtml(localizedWork.content)
  const bodyPlain = jsonToPlainText(localizedWork.content)
  const hasDeliveryUrl = !!(localizedWork.deliveryUrl || localizedWork.figmaUrl)
  // 只用 figmaUrl 构造嵌入预览（服务端变量，不传给客户端）
  const embedUrl = localizedWork.figmaUrl ? figmaEmbedUrl(localizedWork.figmaUrl as string) : null

  return (
    <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
      <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mb-10">
        <Link href={homeHref} className="hover:text-foreground transition-colors flex items-center gap-1 min-w-0 max-w-[30vw] sm:max-w-none truncate">
          <i className="ri-home-4-line shrink-0" /> <span className="truncate">{settings.siteName || defaultSiteName}</span>
        </Link>
        <i className="ri-arrow-right-s-line text-muted-foreground/60 shrink-0" />
        <Link href={listHref} className="hover:text-foreground transition-colors shrink-0">{sectionLabel}</Link>
        <i className="ri-arrow-right-s-line text-muted-foreground/60 shrink-0" />
        <span className="text-foreground truncate min-w-0 max-w-[50vw] sm:max-w-[200px]">{localizedWork.title as string}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Figma 嵌入预览 */}
          {embedUrl && (
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-accent/30">
                <i className="ri-figma-line text-base text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Figma Preview</span>
              </div>
              <iframe
                src={embedUrl}
                className="w-full aspect-[16/10]"
                allowFullScreen
                loading="lazy"
              />
            </div>
          )}

          {/* 详细描述 */}
          {(contentHtml || bodyPlain) && (
            <div className="min-w-0 overflow-x-hidden">
              <div
                className="prose prose-neutral dark:prose-invert prose-sm max-w-none
                  prose-headings:font-serif prose-headings:text-foreground
                  prose-p:text-foreground/70 prose-li:text-foreground/70
                  prose-theme prose-a:no-underline hover:prose-a:underline
                  prose-code:bg-accent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                  prose-pre:bg-accent prose-pre:border prose-pre:border-border
                  prose-blockquote:text-muted-foreground
                  [&_figure]:my-6 [&_figure]:overflow-hidden [&_figure_img]:my-0 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_figcaption]:mt-2
                  [&_.checklist]:list-none [&_.checklist]:pl-0 [&_.checklist_li]:flex [&_.checklist_li]:items-start [&_.checklist_li]:gap-2
                  [&_img]:max-w-full [&_img]:h-auto [&_img]:object-contain [&_img]:rounded-lg"
              >
                {contentHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                ) : (
                  bodyPlain.split("\n").map((line, i) => (
                    <p key={i}>{line || "\u00A0"}</p>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 附加图片 - 等比缩放 + 全屏查看 */}
          {images.length > 0 && (
            <ImageGallery images={images} />
          )}
        </div>

        <div className="lg:col-span-5">
          <PurchaseSidebar
            workId={localizedWork.id as string}
            title={localizedWork.title as string}
            description={(localizedWork.description as string | null) ?? ""}
            categoryName={categoryName}
            tags={tags}
            price={(localizedWork.price as number | null) ?? null}
            isFree={!!localizedWork.isFree}
            hasDeliveryUrl={hasDeliveryUrl}
            updatedAt={localizedWork.updatedAt ? String(localizedWork.updatedAt) : null}
            currentVersion={(localizedWork.currentVersion as string | null) ?? null}
            demoUrl={(localizedWork.demoUrl as string | null) ?? null}
            demoQrCode={(localizedWork.demoQrCode as string | null) ?? null}
            isDev={isDev}
            downloadCount={downloadCount}
            likeCount={(localizedWork.likeCount as number | null) ?? 0}
          />
        </div>
      </div>
    </div>
  )
}
