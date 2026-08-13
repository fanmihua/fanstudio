"use client"
/**
 * ThemeColorProvider：运行时根据主题配置向 :root 和 .dark 动态注入 CSS 变量。
 * 组件从 /api/settings 获取 theme 配置，解析为 CSS 变量后注入到 <style> 标签中。
 */
import { createContext, useContext, useEffect, useState } from "react"
import {
  DEFAULT_THEME,
  resolveThemeVariables,
  type ThemeConfig,
} from "@/lib/theme-presets"

type ThemeColorContextValue = {
  themeConfig: ThemeConfig
  setThemeConfig: (config: ThemeConfig) => void
}

const ThemeColorContext = createContext<ThemeColorContextValue>({
  themeConfig: DEFAULT_THEME,
  setThemeConfig: () => {},
})

export function useThemeColor() {
  return useContext(ThemeColorContext)
}

function buildStyleContent(config: ThemeConfig): string {
  const lightVars = resolveThemeVariables(config, "light")
  const darkVars = resolveThemeVariables(config, "dark")

  const toCSS = (vars: Record<string, string>) =>
    Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n")

  return `:root {\n${toCSS(lightVars)}\n}\n.dark {\n${toCSS(darkVars)}\n}`
}

export function ThemeColorProvider({
  initial,
  children,
}: {
  initial?: ThemeConfig | null
  children: React.ReactNode
}) {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(
    initial ?? DEFAULT_THEME,
  )

  /** 客户端挂载后从 API 获取最新配置 */
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.theme && typeof data.theme === "object") {
          setThemeConfig({
            base: data.theme.base ?? DEFAULT_THEME.base,
            accent: data.theme.accent ?? DEFAULT_THEME.accent,
          })
        }
      })
      .catch(() => {})
  }, [])

  const styleContent = buildStyleContent(themeConfig)

  return (
    <ThemeColorContext.Provider value={{ themeConfig, setThemeConfig }}>
      <style
        id="theme-color-vars"
        dangerouslySetInnerHTML={{ __html: styleContent }}
      />
      {children}
    </ThemeColorContext.Provider>
  )
}
