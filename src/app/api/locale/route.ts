import { NextRequest, NextResponse } from "next/server"
import { isLocale, LOCALE_COOKIE_KEY, normalizeLocale } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const localeParam = new URL(request.url).searchParams.get("locale")
  const locale = normalizeLocale(localeParam)
  const response = NextResponse.json({ locale })
  response.cookies.set(LOCALE_COOKIE_KEY, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  return response
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { locale?: string }
  if (!isLocale(body.locale)) {
    return NextResponse.json({ error: "invalid locale" }, { status: 400 })
  }
  const response = NextResponse.json({ locale: body.locale })
  response.cookies.set(LOCALE_COOKIE_KEY, body.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
  return response
}
