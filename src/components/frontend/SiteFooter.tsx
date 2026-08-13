"use client"

import { FadeContent } from "@/components/react-bits"
import { HoverPopover } from "@/components/ui/hover-popover"
import { useFrontendSettingsContext } from "@/contexts/FrontendSettingsContext"
import Image from "next/image"
import { defaultFooter } from "@/lib/version"
import { defaultNav } from "@/lib/nav-config"
import { IcpLink } from "@/components/frontend/IcpLink"
import {
  ALL_SOCIAL_ENTRIES,
  getSocialEntryLabel,
  isImageUrl,
  normalizeSocialUrl,
} from "@/lib/social-links"
import { getDictionary } from "@/locales"
import { t } from "@/lib/i18n"

export function SiteFooter() {
  const settings = useFrontendSettingsContext()
  const locale = settings?.locale ?? "zh"
  const dict = getDictionary(locale)
  const links = settings?.socialLinks ?? {}
  const logoText =
    (settings?.nav.logoText ?? defaultNav.logoText ?? "").trim() ||
    (settings?.siteName ?? "").trim() ||
    defaultNav.logoText ||
    ""
  const author = settings?.footer?.copyrightText ?? defaultFooter.copyrightText ?? ""
  const year = new Date().getFullYear()

  return (
    <footer className="px-6 md:px-12 lg:px-16 py-12 border-t border-border/40">
      <FadeContent>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="font-serif text-lg font-bold text-foreground tracking-tight">
              {logoText}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span>© {year} {author}</span>
              <span aria-hidden="true">·</span>
              <IcpLink className="hover:text-foreground transition-colors" />
            </p>
          </div>

          <div
            className="h-[2px] w-32 rounded-full opacity-30"
            style={{
              background: "var(--pride-gradient-h)",
            }}
          />

          <div className="flex items-center gap-3 flex-wrap">
            {ALL_SOCIAL_ENTRIES.map(({ key, label, labelEn, icon, type }) => {
              const socialLabel = getSocialEntryLabel({ key, label, labelEn, icon, type }, locale)
              const value = links[key]
              if (!value?.trim()) return null
              if (type === "text") {
                const trimmed = value.trim()
                return (
                  <HoverPopover
                    key={key}
                    content={
                      isImageUrl(trimmed) ? (
                        <div className="flex flex-col items-center gap-2">
                          <Image src={trimmed} alt={`${socialLabel}${t(dict, "frontend.qr_suffix", "二维码")}`} width={144} height={144} unoptimized className="w-36 h-36 rounded-lg object-contain" />
                          <span className="text-xs text-muted-foreground">{socialLabel}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <i className={`${icon} text-base text-muted-foreground`} />
                          <span className="text-sm text-foreground font-medium">{trimmed}</span>
                          <button type="button" className="ml-1 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title={t(dict, "common.copy", "复制")} onClick={() => navigator.clipboard.writeText(trimmed)}>
                            <i className="ri-file-copy-line text-sm" />
                          </button>
                        </div>
                      )
                    }
                  >
                    <span className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors cursor-default">
                      {socialLabel}
                    </span>
                  </HoverPopover>
                )
              }
              return (
                <a
                  key={key}
                  href={normalizeSocialUrl(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  {socialLabel}
                </a>
              )
            })}
          </div>
        </div>
      </FadeContent>

      <div className="h-20 lg:hidden" />
    </footer>
  )
}
