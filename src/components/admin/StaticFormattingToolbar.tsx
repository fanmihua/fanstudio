"use client"
/** BlockNote 富文本格式化工具栏：加粗/斜体/标题/颜色等，与编辑器状态同步。 */
import type { CSSProperties } from "react"
import { useCallback, useEffect, useState } from "react"
import type { BlockNoteEditor } from "@blocknote/core"
import { cn } from "@/lib/utils"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"

const BLOCKNOTE_COLORS = [
  "default", "gray", "brown", "red", "orange",
  "yellow", "green", "blue", "purple", "pink",
] as const

type BNColor = (typeof BLOCKNOTE_COLORS)[number]

/** 颜色 → CSS 值映射（与 BlockNote 内置保持一致） */
const COLOR_MAP: Record<BNColor, { text: string; bg: string }> = {
  default:  { text: "var(--bn-colors-default-text)",       bg: "var(--bn-colors-default-background)" },
  gray:     { text: "#9b9a97",  bg: "#ebeced" },
  brown:    { text: "#64473a",  bg: "#e9e5e3" },
  red:      { text: "#e03e3e",  bg: "#fbe4e4" },
  orange:   { text: "#d9730d",  bg: "#faebdd" },
  yellow:   { text: "#dfab01",  bg: "#fbf3db" },
  green:    { text: "#4d6461",  bg: "#ddedea" },
  blue:     { text: "#0b6e99",  bg: "#ddebf1" },
  purple:   { text: "#6940a5",  bg: "#eae4f2" },
  pink:     { text: "#ad1a72",  bg: "#f4dfeb" },
}

interface ToolbarState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  blockType: string
  headingLevel: number
  textAlignment: string
  textColor: string
  backgroundColor: string
}

const INITIAL_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  blockType: "paragraph",
  headingLevel: 0,
  textAlignment: "left",
  textColor: "default",
  backgroundColor: "default",
}

function ToolbarButton({
  icon,
  title,
  active,
  onClick,
  className: extraCls,
}: {
  icon: string
  title: string
  active?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded text-sm transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        extraCls,
      )}
    >
      <i className={icon} />
    </button>
  )
}

function ToolbarSeparator() {
  return <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />
}

function ColorGrid({
  label,
  activeColor,
  onSelect,
  mode,
}: {
  label: string
  activeColor: string
  onSelect: (c: string) => void
  mode: "text" | "bg"
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="grid grid-cols-5 gap-0.5">
        {BLOCKNOTE_COLORS.map((c) => {
          const isDefault = c === "default"
          const colorStyle: CSSProperties =
            mode === "text"
              ? { color: isDefault ? "var(--foreground)" : COLOR_MAP[c].text }
              : {
                  color: "var(--foreground)",
                  backgroundColor: isDefault ? undefined : COLOR_MAP[c].bg,
                }
          return (
            <button
              key={c}
              type="button"
              title={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(c)}
              className={cn(
                "w-9 h-9 rounded-md text-base font-medium flex items-center justify-center transition-all",
                activeColor === c
                  ? "bg-accent outline-2 outline-primary -outline-offset-2"
                  : "hover:bg-accent/50",
              )}
              style={colorStyle}
            >
              A
            </button>
          )
        })}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StaticFormattingToolbar({ editor }: { editor: BlockNoteEditor<any, any, any> }) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const [state, setState] = useState<ToolbarState>(INITIAL_STATE)
  const [linkUrl, setLinkUrl] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)

  const syncState = useCallback(() => {
    try {
      const styles = editor.getActiveStyles()
      const cursor = editor.getTextCursorPosition()
      const block = cursor.block

      setState({
        bold: !!styles.bold,
        italic: !!styles.italic,
        underline: !!styles.underline,
        strike: !!styles.strike,
        code: !!styles.code,
        blockType: block.type,
        headingLevel:
          block.type === "heading"
            ? ((block.props as Record<string, unknown>).level as number) ?? 0
            : 0,
        textAlignment:
          ((block.props as Record<string, unknown>).textAlignment as string) ?? "left",
        textColor: (styles.textColor as string) ?? "default",
        backgroundColor: (styles.backgroundColor as string) ?? "default",
      })
    } catch {
      /* editor 可能尚未挂载 */
    }
  }, [editor])

  useEffect(() => {
    const timer = window.setTimeout(syncState, 0)
    const unsubSel = editor.onSelectionChange(syncState)
    const unsubChange = editor.onChange(syncState)
    return () => {
      window.clearTimeout(timer)
      unsubSel()
      unsubChange()
    }
  }, [editor, syncState])

  /* ---------- 操作函数 ---------- */

  const toggleStyle = useCallback(
    (style: string) => {
      editor.focus()
      editor.toggleStyles({ [style]: true })
    },
    [editor],
  )

  const setBlockType = useCallback(
    (type: string, props?: Record<string, unknown>) => {
      editor.focus()
      const block = editor.getTextCursorPosition().block
      editor.updateBlock(block, { type: type as never, props: props as never })
    },
    [editor],
  )

  const setAlignment = useCallback(
    (alignment: string) => {
      editor.focus()
      const block = editor.getTextCursorPosition().block
      editor.updateBlock(block, {
        props: { textAlignment: alignment } as never,
      })
    },
    [editor],
  )

  const applyTextColor = useCallback(
    (color: string) => {
      editor.focus()
      if (color === "default") {
        editor.removeStyles({ textColor: "" as never })
      } else {
        editor.addStyles({ textColor: color as never })
      }
    },
    [editor],
  )

  const applyBgColor = useCallback(
    (color: string) => {
      editor.focus()
      if (color === "default") {
        editor.removeStyles({ backgroundColor: "" as never })
      } else {
        editor.addStyles({ backgroundColor: color as never })
      }
    },
    [editor],
  )

  const applyLink = useCallback(() => {
    if (!linkUrl.trim()) return
    editor.focus()
    editor.createLink(linkUrl.trim())
    setLinkUrl("")
    setShowLinkInput(false)
  }, [editor, linkUrl])

  /* ---------- 主渲染 ---------- */

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/20 px-2 py-1">
      {/* 文字样式 */}
      <ToolbarButton icon="ri-bold" title={t("加粗", "Bold")} active={state.bold} onClick={() => toggleStyle("bold")} />
      <ToolbarButton icon="ri-italic" title={t("斜体", "Italic")} active={state.italic} onClick={() => toggleStyle("italic")} />
      <ToolbarButton icon="ri-underline" title={t("下划线", "Underline")} active={state.underline} onClick={() => toggleStyle("underline")} />
      <ToolbarButton icon="ri-strikethrough" title={t("删除线", "Strike")} active={state.strike} onClick={() => toggleStyle("strike")} />
      <ToolbarButton icon="ri-code-line" title={t("行内代码", "Inline code")} active={state.code} onClick={() => toggleStyle("code")} />

      <ToolbarSeparator />

      {/* 区块类型 */}
      <ToolbarButton
        icon="ri-text"
        title={t("正文", "Paragraph")}
        active={state.blockType === "paragraph"}
        onClick={() => setBlockType("paragraph")}
      />
      <ToolbarButton
        icon="ri-h-1"
        title={t("标题 1", "Heading 1")}
        active={state.blockType === "heading" && state.headingLevel === 1}
        onClick={() => setBlockType("heading", { level: 1 })}
      />
      <ToolbarButton
        icon="ri-h-2"
        title={t("标题 2", "Heading 2")}
        active={state.blockType === "heading" && state.headingLevel === 2}
        onClick={() => setBlockType("heading", { level: 2 })}
      />
      <ToolbarButton
        icon="ri-h-3"
        title={t("标题 3", "Heading 3")}
        active={state.blockType === "heading" && state.headingLevel === 3}
        onClick={() => setBlockType("heading", { level: 3 })}
      />

      <ToolbarSeparator />

      {/* 列表 */}
      <ToolbarButton
        icon="ri-list-unordered"
        title={t("无序列表", "Bullet list")}
        active={state.blockType === "bulletListItem"}
        onClick={() => setBlockType("bulletListItem")}
      />
      <ToolbarButton
        icon="ri-list-ordered"
        title={t("有序列表", "Numbered list")}
        active={state.blockType === "numberedListItem"}
        onClick={() => setBlockType("numberedListItem")}
      />
      <ToolbarButton
        icon="ri-checkbox-line"
        title={t("待办列表", "Checklist")}
        active={state.blockType === "checkListItem"}
        onClick={() => setBlockType("checkListItem")}
      />

      <ToolbarSeparator />

      {/* 对齐 */}
      <ToolbarButton
        icon="ri-align-left"
        title={t("左对齐", "Align left")}
        active={state.textAlignment === "left"}
        onClick={() => setAlignment("left")}
      />
      <ToolbarButton
        icon="ri-align-center"
        title={t("居中对齐", "Align center")}
        active={state.textAlignment === "center"}
        onClick={() => setAlignment("center")}
      />
      <ToolbarButton
        icon="ri-align-right"
        title={t("右对齐", "Align right")}
        active={state.textAlignment === "right"}
        onClick={() => setAlignment("right")}
      />

      <ToolbarSeparator />

      {/* 链接 */}
      <Popover open={showLinkInput} onOpenChange={setShowLinkInput}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t("插入链接", "Insert link")}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "flex items-center justify-center h-7 w-7 rounded text-sm transition-colors",
              showLinkInput
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <i className="ri-link" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyLink()}
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={applyLink}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
            >
              {t("确定", "Apply")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ToolbarSeparator />

      {/* 颜色 */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={t("文字和背景颜色", "Text and background colors")}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center justify-center h-7 w-7 rounded text-sm transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <i className="ri-palette-line" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-2 space-y-3" align="start">
          <ColorGrid
            label={t("文字颜色", "Text color")}
            activeColor={state.textColor}
            onSelect={applyTextColor}
            mode="text"
          />
          <ColorGrid
            label={t("背景颜色", "Background color")}
            activeColor={state.backgroundColor}
            onSelect={applyBgColor}
            mode="bg"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
