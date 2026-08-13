"use client"

import { createContext, useContext } from "react"
import type { Locale } from "@/lib/i18n"

type AdminUiLocaleContextValue = {
  locale: Locale
  toggleLocale: () => void
}

const AdminUiLocaleContext = createContext<AdminUiLocaleContextValue>({
  locale: "zh",
  toggleLocale: () => {},
})

export function AdminUiLocaleProvider({
  value,
  children,
}: {
  value: AdminUiLocaleContextValue
  children: React.ReactNode
}) {
  return <AdminUiLocaleContext.Provider value={value}>{children}</AdminUiLocaleContext.Provider>
}

export function useAdminUiLocale(): AdminUiLocaleContextValue {
  return useContext(AdminUiLocaleContext)
}

