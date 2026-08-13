/**
 * 主题预设：shadcn 5 基底灰度 + 9 强调色（8 shadcn + 范米花儿）。
 * 每个预设含亮/暗两套 CSS 变量值。
 */

/* ---------- 类型定义 ---------- */

export type BaseColorId = "neutral" | "stone" | "zinc" | "gray" | "slate"
export type AccentColorId =
  | "fanmihua"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "rose"
  | "violet"
  | "yellow"
  | "default"

export type ThemeConfig = {
  base: BaseColorId
  accent: AccentColorId
}

export const DEFAULT_THEME: ThemeConfig = { base: "neutral", accent: "fanmihua" }

export type ColorPreset = {
  id: string
  name: string
  /** 亮色模式 CSS 变量 */
  light: Record<string, string>
  /** 暗色模式 CSS 变量 */
  dark: Record<string, string>
}

export type AccentPreset = ColorPreset & {
  /** 7 色装饰渐变（用于 pride-gradient 等效果） */
  gradient: string[]
  /** 5 色图表色 */
  charts: string[]
  /** 代表色（用于 UI 预览圆点） */
  preview: string
}

/* ---------- 基底灰度预设 ---------- */

export const BASE_PRESETS: ColorPreset[] = [
  {
    id: "neutral",
    name: "中性",
    light: {
      "--background": "#fafafa",
      "--foreground": "#0a0a0a",
      "--card": "#ffffff",
      "--card-foreground": "#0a0a0a",
      "--popover": "#ffffff",
      "--popover-foreground": "#0a0a0a",
      "--secondary": "#f4f4f5",
      "--secondary-foreground": "#18181b",
      "--muted": "#f4f4f5",
      "--muted-foreground": "#71717a",
      "--accent": "#f4f4f5",
      "--accent-foreground": "#18181b",
      "--border": "#e4e4e7",
      "--input": "#e4e4e7",
      "--ring": "#0a0a0a",
      "--sidebar": "#f4f4f5",
      "--sidebar-foreground": "#09090b",
      "--sidebar-accent": "#f4f4f5",
      "--sidebar-accent-foreground": "#18181b",
      "--sidebar-border": "#e4e4e7",
      "--sidebar-ring": "#0a0a0a",
    },
    dark: {
      "--background": "#0a0a0a",
      "--foreground": "#f5f5f5",
      "--card": "#161616",
      "--card-foreground": "#f5f5f5",
      "--popover": "#161616",
      "--popover-foreground": "#f5f5f5",
      "--secondary": "#1c1c1c",
      "--secondary-foreground": "#f5f5f5",
      "--muted": "#1c1c1c",
      "--muted-foreground": "#a3a3a3",
      "--accent": "#1c1c1c",
      "--accent-foreground": "#f5f5f5",
      "--border": "#333333",
      "--input": "#333333",
      "--ring": "#525252",
      "--sidebar": "#111111",
      "--sidebar-foreground": "#f5f5f5",
      "--sidebar-accent": "#1c1c1c",
      "--sidebar-accent-foreground": "#f5f5f5",
      "--sidebar-border": "#333333",
      "--sidebar-ring": "#525252",
    },
  },
  {
    id: "stone",
    name: "暖石",
    light: {
      "--background": "#fafaf9",
      "--foreground": "#0c0a09",
      "--card": "#ffffff",
      "--card-foreground": "#0c0a09",
      "--popover": "#ffffff",
      "--popover-foreground": "#0c0a09",
      "--secondary": "#f5f5f4",
      "--secondary-foreground": "#1c1917",
      "--muted": "#f5f5f4",
      "--muted-foreground": "#78716c",
      "--accent": "#f5f5f4",
      "--accent-foreground": "#1c1917",
      "--border": "#e7e5e4",
      "--input": "#e7e5e4",
      "--ring": "#0c0a09",
      "--sidebar": "#f5f5f4",
      "--sidebar-foreground": "#0c0a09",
      "--sidebar-accent": "#f5f5f4",
      "--sidebar-accent-foreground": "#1c1917",
      "--sidebar-border": "#e7e5e4",
      "--sidebar-ring": "#0c0a09",
    },
    dark: {
      "--background": "#0c0a09",
      "--foreground": "#fafaf9",
      "--card": "#1c1917",
      "--card-foreground": "#fafaf9",
      "--popover": "#1c1917",
      "--popover-foreground": "#fafaf9",
      "--secondary": "#292524",
      "--secondary-foreground": "#fafaf9",
      "--muted": "#292524",
      "--muted-foreground": "#a8a29e",
      "--accent": "#292524",
      "--accent-foreground": "#fafaf9",
      "--border": "#3d3835",
      "--input": "#3d3835",
      "--ring": "#57534e",
      "--sidebar": "#1c1917",
      "--sidebar-foreground": "#fafaf9",
      "--sidebar-accent": "#292524",
      "--sidebar-accent-foreground": "#fafaf9",
      "--sidebar-border": "#3d3835",
      "--sidebar-ring": "#57534e",
    },
  },
  {
    id: "zinc",
    name: "锌灰",
    light: {
      "--background": "#fafafa",
      "--foreground": "#09090b",
      "--card": "#ffffff",
      "--card-foreground": "#09090b",
      "--popover": "#ffffff",
      "--popover-foreground": "#09090b",
      "--secondary": "#f4f4f5",
      "--secondary-foreground": "#18181b",
      "--muted": "#f4f4f5",
      "--muted-foreground": "#71717a",
      "--accent": "#f4f4f5",
      "--accent-foreground": "#18181b",
      "--border": "#e4e4e7",
      "--input": "#e4e4e7",
      "--ring": "#71717a",
      "--sidebar": "#fafafa",
      "--sidebar-foreground": "#09090b",
      "--sidebar-accent": "#f4f4f5",
      "--sidebar-accent-foreground": "#18181b",
      "--sidebar-border": "#e4e4e7",
      "--sidebar-ring": "#71717a",
    },
    dark: {
      "--background": "#09090b",
      "--foreground": "#fafafa",
      "--card": "#18181b",
      "--card-foreground": "#fafafa",
      "--popover": "#18181b",
      "--popover-foreground": "#fafafa",
      "--secondary": "#27272a",
      "--secondary-foreground": "#fafafa",
      "--muted": "#27272a",
      "--muted-foreground": "#a1a1aa",
      "--accent": "#27272a",
      "--accent-foreground": "#fafafa",
      "--border": "#3f3f46",
      "--input": "#3f3f46",
      "--ring": "#52525b",
      "--sidebar": "#18181b",
      "--sidebar-foreground": "#fafafa",
      "--sidebar-accent": "#27272a",
      "--sidebar-accent-foreground": "#fafafa",
      "--sidebar-border": "#3f3f46",
      "--sidebar-ring": "#52525b",
    },
  },
  {
    id: "gray",
    name: "灰蓝",
    light: {
      "--background": "#f9fafb",
      "--foreground": "#111827",
      "--card": "#ffffff",
      "--card-foreground": "#111827",
      "--popover": "#ffffff",
      "--popover-foreground": "#111827",
      "--secondary": "#f3f4f6",
      "--secondary-foreground": "#1f2937",
      "--muted": "#f3f4f6",
      "--muted-foreground": "#6b7280",
      "--accent": "#f3f4f6",
      "--accent-foreground": "#1f2937",
      "--border": "#e5e7eb",
      "--input": "#e5e7eb",
      "--ring": "#111827",
      "--sidebar": "#f3f4f6",
      "--sidebar-foreground": "#111827",
      "--sidebar-accent": "#f3f4f6",
      "--sidebar-accent-foreground": "#1f2937",
      "--sidebar-border": "#e5e7eb",
      "--sidebar-ring": "#111827",
    },
    dark: {
      "--background": "#111827",
      "--foreground": "#f9fafb",
      "--card": "#1f2937",
      "--card-foreground": "#f9fafb",
      "--popover": "#1f2937",
      "--popover-foreground": "#f9fafb",
      "--secondary": "#374151",
      "--secondary-foreground": "#f9fafb",
      "--muted": "#374151",
      "--muted-foreground": "#9ca3af",
      "--accent": "#374151",
      "--accent-foreground": "#f9fafb",
      "--border": "#4b5563",
      "--input": "#4b5563",
      "--ring": "#6b7280",
      "--sidebar": "#1f2937",
      "--sidebar-foreground": "#f9fafb",
      "--sidebar-accent": "#374151",
      "--sidebar-accent-foreground": "#f9fafb",
      "--sidebar-border": "#4b5563",
      "--sidebar-ring": "#6b7280",
    },
  },
  {
    id: "slate",
    name: "石板蓝",
    light: {
      "--background": "#f8fafc",
      "--foreground": "#0f172a",
      "--card": "#ffffff",
      "--card-foreground": "#0f172a",
      "--popover": "#ffffff",
      "--popover-foreground": "#0f172a",
      "--secondary": "#f1f5f9",
      "--secondary-foreground": "#1e293b",
      "--muted": "#f1f5f9",
      "--muted-foreground": "#64748b",
      "--accent": "#f1f5f9",
      "--accent-foreground": "#1e293b",
      "--border": "#e2e8f0",
      "--input": "#e2e8f0",
      "--ring": "#0f172a",
      "--sidebar": "#f1f5f9",
      "--sidebar-foreground": "#0f172a",
      "--sidebar-accent": "#f1f5f9",
      "--sidebar-accent-foreground": "#1e293b",
      "--sidebar-border": "#e2e8f0",
      "--sidebar-ring": "#0f172a",
    },
    dark: {
      "--background": "#0f172a",
      "--foreground": "#f8fafc",
      "--card": "#1e293b",
      "--card-foreground": "#f8fafc",
      "--popover": "#1e293b",
      "--popover-foreground": "#f8fafc",
      "--secondary": "#334155",
      "--secondary-foreground": "#f8fafc",
      "--muted": "#334155",
      "--muted-foreground": "#94a3b8",
      "--accent": "#334155",
      "--accent-foreground": "#f8fafc",
      "--border": "#475569",
      "--input": "#475569",
      "--ring": "#64748b",
      "--sidebar": "#1e293b",
      "--sidebar-foreground": "#f8fafc",
      "--sidebar-accent": "#334155",
      "--sidebar-accent-foreground": "#f8fafc",
      "--sidebar-border": "#475569",
      "--sidebar-ring": "#64748b",
    },
  },
]

/* ---------- 强调色预设 ---------- */

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "fanmihua",
    name: "范米花儿",
    preview: "#D162A4",
    gradient: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"],
    charts: ["#D52D00", "#EF7627", "#FF9A56", "#D162A4", "#A30262"],
    light: {
      "--primary": "#0a0a0a",
      "--primary-foreground": "#fafafa",
      "--sidebar-primary": "#18181b",
      "--sidebar-primary-foreground": "#fafafa",
    },
    dark: {
      "--primary": "#f5f5f5",
      "--primary-foreground": "#0a0a0a",
      "--sidebar-primary": "#f5f5f5",
      "--sidebar-primary-foreground": "#0a0a0a",
    },
  },
  {
    id: "blue",
    name: "海蓝",
    preview: "#2563eb",
    gradient: ["#1e3a5f", "#1d4ed8", "#3b82f6", "#dbeafe", "#60a5fa", "#2563eb", "#1e40af"],
    charts: ["#2563eb", "#60a5fa", "#93c5fd", "#3b82f6", "#1d4ed8"],
    light: {
      "--primary": "#2563eb",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#2563eb",
      "--sidebar-primary-foreground": "#ffffff",
    },
    dark: {
      "--primary": "#3b82f6",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#3b82f6",
      "--sidebar-primary-foreground": "#ffffff",
    },
  },
  {
    id: "green",
    name: "翠绿",
    preview: "#16a34a",
    gradient: ["#14532d", "#15803d", "#22c55e", "#dcfce7", "#4ade80", "#16a34a", "#166534"],
    charts: ["#16a34a", "#4ade80", "#86efac", "#22c55e", "#15803d"],
    light: {
      "--primary": "#16a34a",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#16a34a",
      "--sidebar-primary-foreground": "#ffffff",
    },
    dark: {
      "--primary": "#22c55e",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#22c55e",
      "--sidebar-primary-foreground": "#ffffff",
    },
  },
  {
    id: "orange",
    name: "暖橙",
    preview: "#ea580c",
    gradient: ["#7c2d12", "#c2410c", "#f97316", "#ffedd5", "#fb923c", "#ea580c", "#9a3412"],
    charts: ["#ea580c", "#fb923c", "#fdba74", "#f97316", "#c2410c"],
    light: {
      "--primary": "#ea580c",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#ea580c",
      "--sidebar-primary-foreground": "#ffffff",
    },
    dark: {
      "--primary": "#f97316",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#f97316",
      "--sidebar-primary-foreground": "#ffffff",
    },
  },
  {
    id: "red",
    name: "正红",
    preview: "#dc2626",
    gradient: ["#7f1d1d", "#b91c1c", "#ef4444", "#fee2e2", "#f87171", "#dc2626", "#991b1b"],
    charts: ["#dc2626", "#f87171", "#fca5a5", "#ef4444", "#b91c1c"],
    light: {
      "--primary": "#dc2626",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#dc2626",
      "--sidebar-primary-foreground": "#ffffff",
    },
    dark: {
      "--primary": "#ef4444",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#ef4444",
      "--sidebar-primary-foreground": "#ffffff",
    },
  },
  {
    id: "rose",
    name: "玫瑰",
    preview: "#e11d48",
    gradient: ["#881337", "#be123c", "#f43f5e", "#ffe4e6", "#fb7185", "#e11d48", "#9f1239"],
    charts: ["#e11d48", "#fb7185", "#fda4af", "#f43f5e", "#be123c"],
    light: {
      "--primary": "#e11d48",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#e11d48",
      "--sidebar-primary-foreground": "#ffffff",
    },
    dark: {
      "--primary": "#f43f5e",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#f43f5e",
      "--sidebar-primary-foreground": "#ffffff",
    },
  },
  {
    id: "violet",
    name: "紫罗兰",
    preview: "#7c3aed",
    gradient: ["#2e1065", "#5b21b6", "#8b5cf6", "#ede9fe", "#a78bfa", "#7c3aed", "#4c1d95"],
    charts: ["#7c3aed", "#a78bfa", "#c4b5fd", "#8b5cf6", "#5b21b6"],
    light: {
      "--primary": "#7c3aed",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#7c3aed",
      "--sidebar-primary-foreground": "#ffffff",
    },
    dark: {
      "--primary": "#8b5cf6",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#8b5cf6",
      "--sidebar-primary-foreground": "#ffffff",
    },
  },
  {
    id: "yellow",
    name: "琥珀",
    preview: "#d97706",
    gradient: ["#78350f", "#b45309", "#f59e0b", "#fef3c7", "#fbbf24", "#d97706", "#92400e"],
    charts: ["#d97706", "#fbbf24", "#fde68a", "#f59e0b", "#b45309"],
    light: {
      "--primary": "#d97706",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#d97706",
      "--sidebar-primary-foreground": "#ffffff",
    },
    dark: {
      "--primary": "#f59e0b",
      "--primary-foreground": "#ffffff",
      "--sidebar-primary": "#f59e0b",
      "--sidebar-primary-foreground": "#ffffff",
    },
  },
  {
    id: "default",
    name: "极简",
    preview: "#737373",
    gradient: ["#262626", "#404040", "#737373", "#f5f5f5", "#a3a3a3", "#525252", "#171717"],
    charts: ["#525252", "#737373", "#a3a3a3", "#404040", "#262626"],
    light: {
      "--primary": "#0a0a0a",
      "--primary-foreground": "#fafafa",
      "--sidebar-primary": "#18181b",
      "--sidebar-primary-foreground": "#fafafa",
    },
    dark: {
      "--primary": "#f5f5f5",
      "--primary-foreground": "#0a0a0a",
      "--sidebar-primary": "#f5f5f5",
      "--sidebar-primary-foreground": "#0a0a0a",
    },
  },
]

/* ---------- 查找工具 ---------- */

export function findBasePreset(id: string): ColorPreset {
  return BASE_PRESETS.find((p) => p.id === id) ?? BASE_PRESETS[0]
}

export function findAccentPreset(id: string): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0]
}

/**
 * 将 ThemeConfig 合并为完整的 CSS 变量 Map（按亮/暗模式）。
 * gradient-1~7 和 chart-1~5 也一并输出。
 */
export function resolveThemeVariables(
  config: ThemeConfig,
  mode: "light" | "dark",
): Record<string, string> {
  const base = findBasePreset(config.base)
  const accent = findAccentPreset(config.accent)
  const modeVars = mode === "light" ? { ...base.light, ...accent.light } : { ...base.dark, ...accent.dark }

  accent.gradient.forEach((color, i) => {
    modeVars[`--color-pride-${i + 1}`] = color
  })
  accent.charts.forEach((color, i) => {
    modeVars[`--chart-${i + 1}`] = color
  })

  return modeVars
}
