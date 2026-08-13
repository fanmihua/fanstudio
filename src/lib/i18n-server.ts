import { cookies } from "next/headers"
import { LOCALE_COOKIE_KEY, normalizeLocale, type Locale } from "@/lib/i18n"

export async function getLocaleFromCookie(): Promise<Locale> {
  const jar = await cookies()
  return normalizeLocale(jar.get(LOCALE_COOKIE_KEY)?.value)
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const jar = await cookies()
  jar.set(LOCALE_COOKIE_KEY, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
}
