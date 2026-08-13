"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { ThemeColorProvider } from "@/components/ThemeColorProvider"

export function AdminThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      storageKey="admin-theme"
      disableTransitionOnChange
    >
      <ThemeColorProvider>
        {children}
      </ThemeColorProvider>
    </ThemeProvider>
  )
}
