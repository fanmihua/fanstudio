/** 内容格式判断与转换：BlockNote/Tiptap 检测、纯文本抽取、HTML 转纯文本、编辑器初始内容。 */
import type { Block } from "@blocknote/core"

/** 判断是否为 BlockNote 格式（Block 数组，每项有 id + type + props）。 */
export function isBlockNoteFormat(raw: unknown): raw is Block[] {
  if (!Array.isArray(raw) || raw.length === 0) return false
  const first = raw[0]
  return (
    first != null &&
    typeof first === "object" &&
    "type" in first &&
    "props" in first
  )
}

/** 判断是否为 Tiptap/ProseMirror 格式（type: 'doc' + content 数组）。 */
export function isTiptapFormat(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false
  const obj = raw as { type?: string; content?: unknown[] }
  return obj.type === "doc" && Array.isArray(obj.content)
}

/** 从 Tiptap/Slate 或 BlockNote JSON 中抽取纯文本。 */
export function jsonToPlainText(content: unknown): string {
  if (!content || typeof content !== "object") return ""

  if (isBlockNoteFormat(content)) {
    return extractBlockNoteText(content)
  }

  const obj = content as {
    children?: Array<{ children?: Array<{ text?: string }> }>
    content?: Array<{ content?: Array<{ text?: string }>; text?: string }>
  }
  const children = obj.children
  if (Array.isArray(children)) {
    const parts: string[] = []
    for (const node of children) {
      const sub = node?.children
      if (Array.isArray(sub)) {
        for (const c of sub) {
          if (c?.text) parts.push(c.text)
        }
      }
    }
    return parts.join("\n")
  }
  const contentArr = obj.content
  if (Array.isArray(contentArr)) {
    const parts: string[] = []
    for (const node of contentArr) {
      if (node?.text) {
        parts.push(node.text)
      } else if (Array.isArray(node?.content)) {
        for (const c of node.content) {
          if (c?.text) parts.push(c.text)
        }
      }
    }
    return parts.join("\n")
  }
  return ""
}

function extractBlockNoteText(blocks: Block[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.content) {
      if (Array.isArray(block.content)) {
        for (const inline of block.content) {
          if (typeof inline === "object" && inline !== null && "text" in inline) {
            parts.push((inline as { text: string }).text)
          }
        }
      }
    }
    if (block.children && block.children.length > 0) {
      parts.push(extractBlockNoteText(block.children))
    }
  }
  return parts.join("\n")
}

/**
 * 去掉 HTML 标签，只保留纯文本（用于列表/摘要等展示，避免显示原始 <p> 等标签）。
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (html == null || typeof html !== "string") return ""
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * 去掉 HTML 标签，但尽量保留段落/列表换行，适合聊天回答这类需要保留排版的文本。
 */
export function htmlToPlainTextWithBreaks(html: string | null | undefined): string {
  if (html == null || typeof html !== "string") return ""
  return html
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<p[^>]*>|<div[^>]*>|<ul[^>]*>|<ol[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

/** 供后台富文本编辑器使用：BlockNote 格式返回原样，其他格式返回 null（编辑器会空白初始化）。 */
export function getInitialContentForEditor(raw: unknown): Block[] | null {
  if (raw === undefined || raw === null) return null
  if (isBlockNoteFormat(raw)) return raw as Block[]
  return null
}
