"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { Magnet } from "@/components/react-bits"
import { useNavConfig } from "@/hooks/useNavConfig"
import { useMounted } from "@/hooks/useMounted"
import { defaultNav } from "@/lib/nav-config"
import { getBeijingVolShort } from "@/lib/date-util"
import { detectLocaleFromPath, withLocalePath } from "@/lib/i18n-path"
import { oppositeLocale } from "@/lib/i18n"
import { resolveFrontendSectionVisibility, resolveNavOrder } from "@/lib/page-copy"

const navKeys = [
  { key: "worksDesign" as const, href: "/works/design", icon: "ri-palette-line" },
  { key: "worksDev" as const, href: "/works/development", icon: "ri-code-s-slash-line" },
  { key: "blog" as const, href: "/blog", icon: "ri-quill-pen-line" },
  { key: "tutorials" as const, href: "/tutorials", icon: "ri-video-line" },
  { key: "about" as const, href: "/about", icon: "ri-user-line" },
]

export function MagazineSidebar({ width = 200 }: { width?: number }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { nav, pageCopy } = useNavConfig()
  const mounted = useMounted()
  const locale = detectLocaleFromPath(pathname || "/")
  const sectionVisibility = resolveFrontendSectionVisibility(pageCopy)
  const navOrder: string[] = resolveNavOrder(pageCopy)
  const navRank = (key: string) => {
    const i = navOrder.indexOf(key)
    return i === -1 ? navOrder.length : i
  }
  const visibleNavItems = navKeys
    .filter((item) => {
      if (item.key === "worksDesign") return sectionVisibility.worksDesign
      if (item.key === "worksDev") return sectionVisibility.worksDev
      if (item.key === "blog") return sectionVisibility.blog
      if (item.key === "tutorials") return sectionVisibility.tutorials
      return true
    })
    .sort((a, b) => navRank(a.key) - navRank(b.key))
  const guestbookHref = "/guestbook"
  const guestbookLabel =
    (locale === "en" ? pageCopy.guestbookNameEn : pageCopy.guestbookName) ||
    (locale === "en" ? "Pull Up a Chair" : "来坐坐")
  const guestbookActive =
    pathname === withLocalePath(guestbookHref, locale) ||
    pathname.startsWith(withLocalePath(guestbookHref, locale))
  const themeDarkLabel = locale === "en" ? "Dark Mode" : (defaultNav.themeDarkLabel ?? "暗色模式")
  const themeLightLabel = locale === "en" ? "Light Mode" : (defaultNav.themeLightLabel ?? "亮色模式")
  const themeLabel = mounted ? (theme === "dark" ? themeLightLabel : themeDarkLabel) : themeDarkLabel
  const nextLocale = oppositeLocale(locale)
  const switchLabel = nextLocale === "en" ? "English" : "中文"

  const logoText = nav.logoText ?? defaultNav.logoText ?? ""
  const parts = logoText.trim().split(".")
  const logoMain = parts[0] ?? logoText
  const logoRest = parts.length > 1 ? "." + parts.slice(1).join(".") : ""

  return (
    <aside
      className="hidden lg:flex fixed left-0 top-0 bottom-0 flex-col justify-between border-r border-border/50 bg-background/80 backdrop-blur-xl z-40 p-6"
      style={{ width, transition: "width 200ms" }}
    >
      <div>
        <Link href={withLocalePath("/", locale)} className="group block mb-10">
          <Magnet strength={0.15}>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
              {logoMain}
              {logoRest && <span className="text-muted-foreground">{logoRest}</span>}
            </h1>
            <div
              className="mt-1 h-[2px] w-8 bg-foreground/20 group-hover:w-full transition-all duration-500"
              style={{ backgroundImage: "var(--pride-gradient-h)" }}
            />
          </Magnet>
        </Link>

        <nav className="space-y-1">
          {visibleNavItems.map((item) => {
            const label = nav[item.key] ?? defaultNav[item.key] ?? item.key
            const isActive =
              pathname === withLocalePath(item.href, locale) ||
              (item.href !== "/" && pathname.startsWith(withLocalePath(item.href, locale)))

            return (
              <Link
                key={item.href}
                href={withLocalePath(item.href, locale)}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative",
                  isActive
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <i className={`${item.icon} text-base`} />
                <span className="font-medium tracking-wide">{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 w-[2px] h-5 rounded-r-full"
                    style={{
                      background: `linear-gradient(180deg, var(--color-pride-1), var(--color-pride-7))`,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}

          {sectionVisibility.guestbook && (
            <>
              <div className="my-3 mx-3 border-t border-border/40" />
              <Link
                href={withLocalePath(guestbookHref, locale)}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative",
                  guestbookActive
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <i className="ri-cup-line text-base" />
                <span className="font-medium tracking-wide">{guestbookLabel}</span>
                {guestbookActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 w-[2px] h-5 rounded-r-full"
                    style={{
                      background: `linear-gradient(180deg, var(--color-pride-1), var(--color-pride-7))`,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 w-full"
        >
          <i className="ri-sun-line dark:hidden text-base" />
          <i className="ri-moon-line hidden dark:inline text-base" />
          <span className="font-medium tracking-wide">{themeLabel}</span>
        </button>
        {sectionVisibility.languageSwitcher && (
          <Link
            href={withLocalePath(pathname || "/", nextLocale)}
            onClick={async () => {
              await fetch("/api/locale", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ locale: nextLocale }),
              }).catch(() => {})
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 w-full"
          >
            <i className="ri-translate-2 text-base" />
            <span className="font-medium tracking-wide">{switchLabel}</span>
          </Link>
        )}

        <div className="pt-4 border-t border-border/50">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-mono">
            {getBeijingVolShort()}
          </p>
        </div>
      </div>
    </aside>
  )
}
