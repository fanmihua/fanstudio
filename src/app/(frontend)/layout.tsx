/** 前台根布局：拉取设置并注入 FrontendLayoutClient。 */
import { getFrontendSettings } from "@/lib/settings-server"
import FrontendLayoutClient from "./FrontendLayoutClient"

export const dynamic = "force-dynamic"

export default async function FrontendLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initial = await getFrontendSettings()
  return (
    <FrontendLayoutClient initial={initial}>
      {children}
    </FrontendLayoutClient>
  )
}
