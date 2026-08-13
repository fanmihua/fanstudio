/**
 * BlockNote JSON → HTML，纯服务端实现，可在 Server Component / Route Handler 中使用。
 * 类型仅本文件使用，不依赖 @blocknote/core。
 */

interface InlineText {
  type: "text"
  text: string
  styles?: Record<string, boolean | string>
}

interface InlineLink {
  type: "link"
  href: string
  content: InlineContent[]
}

type InlineContent = InlineText | InlineLink

export type ContentHeading = {
  id: string
  text: string
  level: number
}

interface TableCell {
  type: "tableCell"
  content?: InlineContent[]
}

interface TableRow {
  type: "tableRow"
  cells: (InlineContent[] | TableCell)[]
}

interface TableContent {
  type: "tableContent"
  rows: TableRow[]
}

interface BNBlock {
  id?: string
  type: string
  props?: Record<string, unknown>
  content?: InlineContent[] | TableContent
  children?: BNBlock[]
}

/* ------------------------------------------------------------------ */
/*  工具函数                                                           */
/* ------------------------------------------------------------------ */

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * URL 协议白名单：拦截 javascript:/data:/vbscript: 等危险 scheme，防止
 * <a href> / 媒体 src 触发 XSS。带 scheme 的只放行 http(s)/mailto/tel；
 * 无 scheme 的相对路径、锚点、协议相对地址一律放行。返回空串表示拒绝。
 */
function safeUrl(url: unknown): string {
  const s = typeof url === "string" ? url.trim() : ""
  if (!s) return ""
  const scheme = s.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/)
  if (scheme) {
    const name = scheme[1].toLowerCase()
    if (!["http", "https", "mailto", "tel"].includes(name)) return ""
  }
  return s
}

function styleAttr(parts: string[]): string {
  const s = parts.filter(Boolean).join("; ")
  return s ? ` style="${esc(s)}"` : ""
}

/* ------------------------------------------------------------------ */
/*  行内内容 → HTML                                                    */
/* ------------------------------------------------------------------ */

function inlineToHtml(items: InlineContent[]): string {
  if (!items || !Array.isArray(items)) return ""
  return items.map(renderInline).join("")
}

function inlineToText(items: InlineContent[]): string {
  if (!items || !Array.isArray(items)) return ""
  return items.map((node) => node.type === "link" ? inlineToText(node.content ?? []) : (node.text ?? "")).join("")
}

function headingAnchorId(block: BNBlock): string {
  const stableId = typeof block.id === "string" ? block.id.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") : ""
  if (stableId) return `section-${stableId}`

  const text = Array.isArray(block.content) ? inlineToText(block.content) : "section"
  let hash = 5381
  for (const char of text) hash = ((hash << 5) + hash) ^ char.codePointAt(0)!
  return `section-${(hash >>> 0).toString(36)}`
}

export function extractBlockNoteHeadings(content: unknown): ContentHeading[] {
  if (!Array.isArray(content)) return []
  const headings: ContentHeading[] = []

  const visit = (blocks: BNBlock[]) => {
    for (const block of blocks) {
      if (block.type === "heading") {
        const level = Math.min(Math.max(Number(block.props?.level) || 1, 1), 6)
        const text = Array.isArray(block.content) ? inlineToText(block.content).trim() : ""
        // 文章 H1 是页面标题；目录默认只展示正文一级章节（H2）。
        // H3 仍会生成稳定锚点，方便分享深链，但不进入侧边目录。
        if (text && level === 2) {
          headings.push({ id: headingAnchorId(block), text, level })
        }
      }
      if (block.children?.length) visit(block.children)
    }
  }

  visit(content as BNBlock[])
  return headings
}

function renderInline(node: InlineContent): string {
  if (node.type === "link") {
    const inner = inlineToHtml(node.content ?? [])
    return `<a href="${esc(safeUrl(node.href))}" target="_blank" rel="noopener noreferrer">${inner}</a>`
  }

  // text
  let html = esc(node.text ?? "")
  const s = node.styles ?? {}

  if (s.bold) html = `<strong>${html}</strong>`
  if (s.italic) html = `<em>${html}</em>`
  if (s.underline) html = `<u>${html}</u>`
  if (s.strikethrough || s.strike) html = `<s>${html}</s>`
  if (s.code) html = `<code>${html}</code>`

  // 文字颜色 / 背景色
  const colorParts: string[] = []
  if (typeof s.textColor === "string" && s.textColor) colorParts.push(`color: ${s.textColor}`)
  if (typeof s.backgroundColor === "string" && s.backgroundColor) colorParts.push(`background-color: ${s.backgroundColor}`)
  if (colorParts.length) {
    html = `<span${styleAttr(colorParts)}>${html}</span>`
  }

  return html
}

/* ------------------------------------------------------------------ */
/*  块级内容 → HTML                                                    */
/* ------------------------------------------------------------------ */

function blockContentHtml(block: BNBlock): string {
  if (!block.content) return ""
  if (Array.isArray(block.content)) return inlineToHtml(block.content)
  return ""
}

function alignAttr(props: Record<string, unknown>): string {
  const a = props?.textAlignment as string | undefined
  if (a && a !== "left") return styleAttr([`text-align: ${a}`])
  return ""
}

function renderChildren(children: BNBlock[] | undefined): string {
  if (!children || children.length === 0) return ""
  return blocksToHtml(children)
}

/* ------------------------------------------------------------------ */
/*  表格                                                               */
/* ------------------------------------------------------------------ */

function renderTable(block: BNBlock): string {
  const tc = block.content as TableContent | undefined
  if (!tc || tc.type !== "tableContent" || !Array.isArray(tc.rows)) return ""

  const rows = tc.rows.map((row, ri) => {
    const tag = ri === 0 ? "th" : "td"
    const cells = (row.cells ?? []).map((cell) => {
      // cell 可能是 InlineContent[] 或 TableCell 对象
      const content = Array.isArray(cell)
        ? inlineToHtml(cell)
        : inlineToHtml((cell as TableCell).content ?? [])
      return `<${tag}>${content}</${tag}>`
    }).join("")
    return `<tr>${cells}</tr>`
  }).join("")

  return `<table>${rows}</table>`
}

/* ------------------------------------------------------------------ */
/*  单个块 → HTML                                                      */
/* ------------------------------------------------------------------ */

function blockToHtml(block: BNBlock): string {
  const props = block.props ?? {}
  const align = alignAttr(props)
  const inner = blockContentHtml(block)
  const kids = renderChildren(block.children)

  switch (block.type) {
    case "paragraph":
      return `<p${align}>${inner || "<br>"}</p>${kids}`

    case "heading": {
      const level = Number(props.level) || 1
      const tag = `h${Math.min(Math.max(level, 1), 6)}`
      return `<${tag} id="${esc(headingAnchorId(block))}"${align}>${inner}</${tag}>${kids}`
    }

    case "bulletListItem":
      return `<li>${inner}${kids}</li>`

    case "numberedListItem":
      return `<li>${inner}${kids}</li>`

    case "checkListItem": {
      const checked = props.checked ? " checked" : ""
      return `<li><input type="checkbox" disabled${checked}> ${inner}${kids}</li>`
    }

    case "codeBlock": {
      const lang = typeof props.language === "string" ? props.language : ""
      const cls = lang ? ` class="language-${esc(lang)}"` : ""
      return `<pre><code${cls}>${inner}</code></pre>${kids}`
    }

    case "image": {
      const src = (props.url ?? props.src ?? "") as string
      const alt = (props.caption ?? props.alt ?? "") as string
      // BlockNote 用 previewWidth 存储用户调整后的像素宽度
      const pw = props.previewWidth ?? props.width
      const imgStyle = pw
        ? ` style="width: ${Number(pw)}px; max-width: 100%"`
        : ""
      if (!src) return kids
      let html = `<img src="${esc(safeUrl(src))}" alt="${esc(alt)}"${imgStyle} />`
      if (alt) html += `<figcaption>${esc(alt)}</figcaption>`
      return `<figure${imgStyle}>${html}</figure>${kids}`
    }

    case "video": {
      const src = (props.url ?? "") as string
      const pw = props.previewWidth ?? props.width
      const vidStyle = pw
        ? ` style="width: ${Number(pw)}px; max-width: 100%"`
        : ""
      if (!src) return kids
      return `<video controls${vidStyle} src="${esc(safeUrl(src))}"></video>${kids}`
    }

    case "audio": {
      const src = (props.url ?? "") as string
      if (!src) return kids
      return `<audio controls src="${esc(safeUrl(src))}"></audio>${kids}`
    }

    case "file": {
      const src = (props.url ?? "") as string
      // caption 多为空字符串：?? 只挡 null/undefined，挡不住 ""，会导致链接文字为空（前台看不见）
      // 改用 || 让空串回退到文件名，再回退到默认文案
      const name = (props.caption as string) || (props.name as string) || "下载文件"
      if (!src) return kids
      return `<p><a href="${esc(safeUrl(src))}" download><i class="ri-download-line"></i> ${esc(name)}</a></p>${kids}`
    }

    case "divider":
      return `<hr />${kids}`

    case "table":
      return renderTable(block) + kids

    default:
      // 未知类型：尝试渲染行内内容
      if (inner) return `<p${align}>${inner}</p>${kids}`
      return kids
  }
}

/* ------------------------------------------------------------------ */
/*  块数组 → HTML（自动合并连续列表项为 <ul> / <ol>）                    */
/* ------------------------------------------------------------------ */

/** 判断一个块是否为空段落（无文字内容） */
function isEmptyParagraph(block: BNBlock): boolean {
  if (block.type !== "paragraph") return false
  if (!block.content || !Array.isArray(block.content)) return true
  return block.content.length === 0
}

export function blocksToHtml(blocks: BNBlock[]): string {
  if (!blocks || !Array.isArray(blocks)) return ""

  const parts: string[] = []
  let i = 0

  while (i < blocks.length) {
    const block = blocks[i]

    // 合并连续空段落：多个空段落只输出一个 <br>
    if (isEmptyParagraph(block)) {
      while (i < blocks.length && isEmptyParagraph(blocks[i])) {
        i++
      }
      parts.push("<br>")
      continue
    }

    if (block.type === "bulletListItem") {
      const items: string[] = []
      while (i < blocks.length && blocks[i].type === "bulletListItem") {
        items.push(blockToHtml(blocks[i]))
        i++
      }
      parts.push(`<ul>${items.join("")}</ul>`)
      continue
    }

    if (block.type === "numberedListItem") {
      const items: string[] = []
      while (i < blocks.length && blocks[i].type === "numberedListItem") {
        items.push(blockToHtml(blocks[i]))
        i++
      }
      parts.push(`<ol>${items.join("")}</ol>`)
      continue
    }

    if (block.type === "checkListItem") {
      const items: string[] = []
      while (i < blocks.length && blocks[i].type === "checkListItem") {
        items.push(blockToHtml(blocks[i]))
        i++
      }
      parts.push(`<ul class="checklist">${items.join("")}</ul>`)
      continue
    }

    parts.push(blockToHtml(block))
    i++
  }

  return parts.join("")
}

/* ------------------------------------------------------------------ */
/*  主入口：接收 BlockNote Block[] JSON → HTML string                  */
/* ------------------------------------------------------------------ */

export function blockNoteToHtml(content: unknown): string | null {
  if (!content || !Array.isArray(content)) return null
  const first = content[0]
  if (!first || typeof first !== "object" || !("type" in first)) return null
  return blocksToHtml(content as BNBlock[])
}
