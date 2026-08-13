"use client"
/** 简易 Tiptap 富文本（摘要/简介等）：加粗、列表、引用、行内代码。 */
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface MiniEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  /** 编辑器最小高度 class，默认 min-h-[120px] */
  minHeight?: string
}

const TOOLBAR_BUTTONS = [
  { action: "bold", icon: "ri-bold", titleZh: "加粗", titleEn: "Bold" },
  { action: "italic", icon: "ri-italic", titleZh: "斜体", titleEn: "Italic" },
  { action: "strike", icon: "ri-strikethrough", titleZh: "删除线", titleEn: "Strike" },
  { action: "sep" },
  { action: "bulletList", icon: "ri-list-unordered", titleZh: "无序列表", titleEn: "Bullet list" },
  { action: "orderedList", icon: "ri-list-ordered", titleZh: "有序列表", titleEn: "Numbered list" },
  { action: "sep" },
  { action: "blockquote", icon: "ri-double-quotes-l", titleZh: "引用", titleEn: "Quote" },
  { action: "code", icon: "ri-code-line", titleZh: "行内代码", titleEn: "Inline code" },
] as const

export function MiniEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "min-h-[120px]",
}: MiniEditorProps) {
  const { locale } = useAdminUiLocale()
  const defaultPlaceholder = locale === "en" ? "Enter content…" : "输入内容…"
  const placeholderText = placeholder ?? defaultPlaceholder
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2",
          "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-blockquote:my-2",
          "prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 prose-li:pl-0.5",
          "prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
          minHeight
        ),
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      // tiptap 空内容时返回 "<p></p>"，视为空字符串
      onChange(html === "<p></p>" ? "" : html)
    },
  })

  // 外部 value 变化时同步（仅在 value 与编辑器内容不同时更新，避免光标跳动）
  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml
    const normalizedValue = value || ""
    if (normalizedCurrent !== normalizedValue) {
      editor.commands.setContent(normalizedValue || "")
    }
  }, [editor, value])

  const toggleAction = useCallback(
    (action: string) => {
      if (!editor) return
      switch (action) {
        case "bold":
          editor.chain().focus().toggleBold().run()
          break
        case "italic":
          editor.chain().focus().toggleItalic().run()
          break
        case "strike":
          editor.chain().focus().toggleStrike().run()
          break
        case "bulletList":
          editor.chain().focus().toggleBulletList().run()
          break
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run()
          break
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run()
          break
        case "code":
          editor.chain().focus().toggleCode().run()
          break
      }
    },
    [editor]
  )

  const isActive = useCallback(
    (action: string) => {
      if (!editor) return false
      return editor.isActive(action)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor?.state]
  )

  if (!editor) return null

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background overflow-hidden transition-colors focus-within:ring-1 focus-within:ring-ring",
        className
      )}
    >
      {/* toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border/50 px-1.5 py-1 bg-muted/30">
        {TOOLBAR_BUTTONS.map((btn, i) => {
          if (btn.action === "sep") {
            return (
              <div
                key={`sep-${i}`}
                className="w-px h-4 bg-border/50 mx-1"
              />
            )
          }
          const active = isActive(btn.action)
          return (
            <button
              key={btn.action}
              type="button"
              title={locale === "en" ? btn.titleEn : btn.titleZh}
              onClick={() => toggleAction(btn.action)}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded text-sm transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <i className={btn.icon} />
            </button>
          )
        })}
      </div>

      {/* editor area */}
      <div className="relative">
        {!value && !editor.isFocused && editor.isEmpty && (
          <div className="absolute top-0 left-0 px-3 py-2 text-sm text-muted-foreground/50 pointer-events-none">
            {placeholderText}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
