import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { getSettingsRow } from "@/lib/settings-db"
import { normalizeSiteName, defaultSiteDescription } from "@/lib/page-copy"
import type { PageCopy } from "@/lib/page-copy"
import { getLocaleFromCookie } from "@/lib/i18n-server"
import "remixicon/fonts/remixicon.css"
import "./globals.css"

export const dynamic = "force-dynamic"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
})

export async function generateMetadata(): Promise<Metadata> {
  const row = await getSettingsRow()
  const siteName = normalizeSiteName(row?.siteName)
  const pageCopy = row?.pageCopy && typeof row.pageCopy === "object"
    ? (row.pageCopy as PageCopy)
    : {}
  const description = pageCopy.siteDescription?.trim() || defaultSiteDescription
  const siteFavicon = pageCopy.siteFavicon?.trim()
  const defaultFavicon = row?.updatedAt
    ? `/icon?default=${row.updatedAt.getTime()}`
    : "/icon"
  const favicon = siteFavicon || defaultFavicon

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    icons: {
      icon: favicon,
      apple: favicon,
      shortcut: favicon,
    },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocaleFromCookie()
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} suppressHydrationWarning>
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="https://mcp.figma.com/mcp/html-to-design/capture.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
