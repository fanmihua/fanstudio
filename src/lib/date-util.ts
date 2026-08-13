const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * 获取当前北京时间对应的 Date（用于月/年等展示）。
 */
export function getBeijingDate(): Date {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + BEIJING_OFFSET_MS)
}

/**
 * 按北京时间的完整日期格式，用于 Hero 等展示，如 "02.07 — 2026"。
 */
export function getBeijingVolLabel(): string {
  const d = getBeijingDate()
  const month = (d.getMonth() + 1).toString().padStart(2, "0")
  const day = d.getDate().toString().padStart(2, "0")
  const year = d.getFullYear()
  return `${month}.${day} — ${year}`
}

/**
 * 按北京时间的完整日期格式，用于侧栏等，如 "2026.02.07"。
 */
export function getBeijingVolShort(): string {
  const d = getBeijingDate()
  const month = (d.getMonth() + 1).toString().padStart(2, "0")
  const day = d.getDate().toString().padStart(2, "0")
  const year = d.getFullYear()
  return `${year}.${month}.${day}`
}
