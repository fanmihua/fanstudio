export const COVER_RATIO_OPTIONS = [
  {
    id: "3:4",
    label: "3:4（竖版）",
    css: "3 / 4",
    recommendText: "建议 3:4，如 1200x1600（最小 750x1000）",
  },
  {
    id: "4:3",
    label: "4:3（横版）",
    css: "4 / 3",
    recommendText: "建议 4:3，如 1600x1200（最小 1200x900）",
  },
  {
    id: "16:9",
    label: "16:9（宽屏）",
    css: "16 / 9",
    recommendText: "建议 16:9，如 1920x1080（最小 1280x720）",
  },
  {
    id: "1:1",
    label: "1:1（方图）",
    css: "1 / 1",
    recommendText: "建议 1:1，如 1200x1200（最小 1080x1080）",
  },
  {
    id: "19:6",
    label: "19:6（超宽）",
    css: "19 / 6",
    recommendText: "建议 19:6，如 1900x600（最小 1520x480）",
  },
] as const

export type CoverRatioId = (typeof COVER_RATIO_OPTIONS)[number]["id"]

export const DEFAULT_COVER_RATIO: CoverRatioId = "3:4"

const COVER_RATIO_MAP = new Map(
  COVER_RATIO_OPTIONS.map((item) => [item.id, item]),
)

export function normalizeCoverRatio(value: unknown): CoverRatioId {
  if (typeof value !== "string") return DEFAULT_COVER_RATIO
  return COVER_RATIO_MAP.has(value as CoverRatioId)
    ? (value as CoverRatioId)
    : DEFAULT_COVER_RATIO
}

export function coverRatioToCss(value: unknown): string {
  const id = normalizeCoverRatio(value)
  return COVER_RATIO_MAP.get(id)?.css ?? "3 / 4"
}

export function getCoverRatioRecommendText(value: unknown): string {
  const id = normalizeCoverRatio(value)
  return (
    COVER_RATIO_MAP.get(id)?.recommendText ??
    "建议 3:4，如 1200x1600（最小 750x1000）"
  )
}
