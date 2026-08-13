import type { I18nDict, Locale } from "@/lib/i18n"
import zh from "./zh"
import en from "./en"

const all: Record<Locale, I18nDict> = {
  zh,
  en,
}

export function getDictionary(locale: Locale): I18nDict {
  return all[locale]
}
