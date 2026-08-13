"use client"
/** 关于我页面：头像、简介、社交链接、工作/教育/技能等，数据来自后台「关于我」设置。 */
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { FadeContent } from "@/components/react-bits"
import { useNavConfig } from "@/hooks/useNavConfig"

import { ALL_SOCIAL_ENTRIES, getSocialEntryLabel, normalizeSocialUrl, isImageUrl, type SocialLinks } from "@/lib/social-links"
import { HoverPopover } from "@/components/ui/hover-popover"
import { CardDescriptionHtml } from "@/components/frontend/CardDescriptionHtml"
import { normalizeAboutModules, type AboutModules } from "@/lib/about-types"
import { defaultNav } from "@/lib/nav-config"
import { defaultPageCopy, defaultSiteName } from "@/lib/page-copy"
import { LifeWall } from "@/components/frontend/LifeWall"
import { getDictionary } from "@/locales"
import { t } from "@/lib/i18n"

type Settings = {
  siteName?: string
  avatar?: string | null
  socialLinks?: SocialLinks | null
  about?: AboutModules | null
}

export default function AboutPage() {
  const { nav, pageCopy, siteName, locale } = useNavConfig()
  const dict = getDictionary(locale)
  const sectionLabel = nav.about ?? defaultNav.about ?? ""
  const sectionDesc = pageCopy.aboutDesc ?? defaultPageCopy.aboutDesc ?? ""
  const showResume = pageCopy.showResume !== false
  const showPortfolio = pageCopy.showPortfolio !== false
  const resumeUrl = pageCopy.resumeUrl || defaultPageCopy.resumeUrl || ""
  const portfolioUrl = pageCopy.portfolioUrl || defaultPageCopy.portfolioUrl || ""
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"formal" | "life">("formal")
  const lifeMoments = pageCopy.lifeMoments ?? []

  useEffect(() => {
    fetch(`/api/settings?locale=${locale}`)
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false))
  }, [locale])

  const aboutModules = normalizeAboutModules(settings?.about)
  const intro = aboutModules.intro ?? ""
  const workExperience = aboutModules.workExperience ?? []
  const education = aboutModules.education ?? []
  const skills = aboutModules.skills ?? []
  const profileCard = aboutModules.profileCard
  const studioName = profileCard?.studioName?.trim()
  const personalName = profileCard?.personalName?.trim()
  const personalTitle = profileCard?.personalTitle?.trim()
  const displayStudioName = studioName || settings?.siteName || defaultSiteName
  const hasAnyModule =
    intro.length > 0 ||
    workExperience.length > 0 ||
    education.length > 0 ||
    skills.length > 0
  const avatar = settings?.avatar ?? ""
  const links = settings?.socialLinks ?? {}

  if (loading) {
    return (
      <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 flex items-center justify-center text-muted-foreground">
        {t(dict, "common.loading", "加载中...")}
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
      <FadeContent>
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-10">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <i className="ri-home-4-line" /> {siteName || defaultSiteName}
          </Link>
          <i className="ri-arrow-right-s-line text-muted-foreground/40" />
          <span className="text-foreground">{sectionLabel}</span>
        </nav>
      </FadeContent>

      <FadeContent delay={0.1}>
        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-3">
            {sectionLabel}
          </h1>
          {sectionDesc && (
            <p className="text-muted-foreground text-lg">{sectionDesc}</p>
          )}
        </div>
      </FadeContent>

      {/* tab 切换：正式版 / 真实版（整页切换） */}
      <div className="mb-10 flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("formal")}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "formal" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {locale === "en" ? "The Official Me" : "正式版"}
        </button>
        <button
          type="button"
          onClick={() => setTab("life")}
          className={`relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            tab === "life" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {locale === "en" ? "The Real Me" : "真实版"}
        </button>
      </div>

      {tab === "life" ? (
        <LifeWall moments={lifeMoments} isEn={locale === "en"} />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        <FadeContent className="lg:col-span-4" delay={0.2}>
          <div className="lg:sticky lg:top-12">
            <div className="mb-6">
              <div className="w-full aspect-[4/5] max-w-[280px] rounded-2xl bg-accent border border-border overflow-hidden">
                {avatar ? (
                  <Image
                    src={avatar}
                    unoptimized
                    alt={displayStudioName}
                    width={280}
                    height={350}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                    <i className="ri-user-line text-6xl" />
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2">
              {displayStudioName}
            </h2>
            {(personalName || personalTitle) ? (
              <div className="flex flex-wrap gap-2 mb-4">
                {personalName ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-accent/50 px-3 py-1 text-xs text-foreground">
                    {personalName}
                  </span>
                ) : null}
                {personalTitle ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-accent/50 px-3 py-1 text-xs text-foreground">
                    {personalTitle}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {ALL_SOCIAL_ENTRIES.map(({ key, icon, label, labelEn, type }) => {
                const socialLabel = getSocialEntryLabel({ key, label, labelEn, icon, type }, locale)
                const value = links[key]
                if (!value?.trim()) return null

                if (type === "text") {
                  const trimmed = value.trim()
                  const isImg = isImageUrl(trimmed)
                  return (
                    <HoverPopover
                      key={key}
                      content={
                        isImg ? (
                          <div className="flex flex-col items-center gap-2">
                            <img src={trimmed} alt={`${socialLabel}${t(dict, "frontend.qr_suffix", "二维码")}`} className="w-36 h-36 rounded-lg object-contain" />
                            <span className="text-xs text-muted-foreground">{socialLabel}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <i className={`${icon} text-base text-muted-foreground`} />
                            <span className="text-sm text-foreground font-medium">{trimmed}</span>
                            <button
                              type="button"
                              className="ml-1 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              title={t(dict, "common.copy", "复制")}
                              onClick={() => navigator.clipboard.writeText(trimmed)}
                            >
                              <i className="ri-file-copy-line text-sm" />
                            </button>
                          </div>
                        )
                      }
                    >
                      <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-default">
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
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {socialLabel}
                </a>
              )
            })}
            </div>

            {(showResume || showPortfolio) && (
            <div className="flex flex-col gap-2 mt-5">
              {showResume && resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors w-full"
              >
                <i className="ri-file-user-line text-base" />
                {t(dict, "frontend.view_resume", "查看简历")}
              </a>
              )}
              {showPortfolio && portfolioUrl && (
              <a
                href={portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors w-full"
              >
                <i className="ri-image-2-line text-base" />
                {t(dict, "frontend.view_portfolio", "查看作品集")}
              </a>
              )}
            </div>
            )}
          </div>
        </FadeContent>

        <FadeContent className="lg:col-span-8" delay={0.3}>
          <div className="prose prose-neutral dark:prose-invert max-w-none
            prose-p:text-foreground/80 prose-p:leading-relaxed
            prose-headings:font-serif prose-headings:text-foreground
          ">
            {!hasAnyModule ? (
              <p className="text-muted-foreground">{t(dict, "common.empty_prefix", "暂无")}{sectionLabel}{t(dict, "frontend.empty_suffix_content", "内容")}</p>
            ) : (
              <div className="space-y-10">
                {intro ? (
                  <section>
                    <CardDescriptionHtml
                      html={intro}
                      lines={false}
                      className="text-foreground/80 leading-relaxed text-base"
                    />
                  </section>
                ) : null}

                {workExperience.length > 0 ? (
                  <section>
                    <h2 className="font-serif text-xl font-bold text-foreground mb-4">
                      {pageCopy.aboutWorkTitle ?? defaultPageCopy.aboutWorkTitle}
                    </h2>
                    <ul className="space-y-4 list-none pl-0">
                      {workExperience.map((item, index) => (
                        <li
                          key={index}
                          className="border-l-2 border-border pl-4 py-1"
                        >
                          <div className="font-medium text-foreground">
                            {[item.role, item.company].filter(Boolean).join(" · ")}
                          </div>
                          {item.period ? (
                            <div className="text-sm text-muted-foreground">
                              {item.period}
                            </div>
                          ) : null}
                          {item.description ? (
                            <CardDescriptionHtml
                              html={item.description}
                              lines={false}
                              className="mt-1 text-foreground/80 text-sm leading-relaxed"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {education.length > 0 ? (
                  <section>
                    <h2 className="font-serif text-xl font-bold text-foreground mb-4">
                      {pageCopy.aboutEducationTitle ?? defaultPageCopy.aboutEducationTitle}
                    </h2>
                    <ul className="space-y-3 list-none pl-0">
                      {education.map((item, index) => (
                        <li
                          key={index}
                          className="border-l-2 border-border pl-4 py-1"
                        >
                          <div className="font-medium text-foreground">
                            {[item.school, item.degree].filter(Boolean).join(" · ")}
                          </div>
                          {item.period ? (
                            <div className="text-sm text-muted-foreground">
                              {item.period}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {skills.length > 0 ? (
                  <section>
                    <h2 className="font-serif text-xl font-bold text-foreground mb-4">
                      {pageCopy.aboutSkillsTitle ?? defaultPageCopy.aboutSkillsTitle}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((item, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-accent/50 px-3 py-1 text-sm text-foreground"
                        >
                          {item.name}
                          {item.level ? (
                            <span className="text-muted-foreground text-xs">
                              {item.level}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </FadeContent>
      </div>
      )}
    </div>
  )
}
