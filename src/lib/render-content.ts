import { blockNoteToHtml, extractBlockNoteHeadings, type ContentHeading } from "@/lib/blocknote-to-html"
import { isBlockNoteFormat, isTiptapFormat, jsonToPlainText } from "@/lib/content-format"

/** 将内容转为 HTML（服务端）。支持 BlockNote 与 Tiptap 格式，其它返回 null。 */
export function contentToHtml(content: unknown): string | null {
  if (!content || typeof content !== "object") return null

  if (isBlockNoteFormat(content)) {
    try {
      return blockNoteToHtml(content)
    } catch (e) {
      console.error("[contentToHtml] BlockNote render error:", e)
      return null
    }
  }

  if (isTiptapFormat(content)) {
    const text = jsonToPlainText(content)
    if (!text.trim()) return null
    return text
      .split("\n")
      .map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`)
      .join("")
  }

  return null
}

export function extractContentHeadings(content: unknown): ContentHeading[] {
  return isBlockNoteFormat(content) ? extractBlockNoteHeadings(content) : []
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export { jsonToPlainText }
