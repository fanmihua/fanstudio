/** 后台根布局：鉴权、侧栏、站点名，子路由为各管理页。 */
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient"
import { AdminThemeWrapper } from "@/components/admin/AdminThemeWrapper"
import { auth } from "@/lib/auth"
import { getSettingsRow } from "@/lib/settings-db"
import { normalizeSiteName } from "@/lib/page-copy"
import { redirect } from "next/navigation"
import { fromPrismaLocale } from "@/lib/i18n"

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/admin/login")
  }

  const settings = await getSettingsRow()
  const siteName = normalizeSiteName(settings?.siteName)
  const defaultLocale = fromPrismaLocale(settings?.defaultLocale)
  const isViewer = (session.user as { role?: string }).role === "VIEWER"

  return (
    <AdminThemeWrapper>
      <div className="min-h-screen bg-background transition-colors duration-300">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 grid-bg opacity-[0.03]" />
        </div>
        {isViewer && (
          <div className="sticky top-0 z-50 bg-amber-500/90 text-amber-950 text-center text-sm font-medium py-2 px-4 backdrop-blur-sm">
            <i className="ri-eye-line mr-1.5 align-middle" />
            {defaultLocale === "en"
              ? "Viewer account: read-only access."
              : "当前为体验账户，仅供浏览，无法修改内容"}
          </div>
        )}
        <AdminDashboardClient siteName={siteName} defaultLocale={defaultLocale}>{children}</AdminDashboardClient>
      </div>
    </AdminThemeWrapper>
  )
}
