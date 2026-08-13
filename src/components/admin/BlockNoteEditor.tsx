"use client"
/** BlockNote 富文本编辑器：工具栏、媒体上传、主题随系统。 */
import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { createPortal } from "react-dom"
import {
  useCreateBlockNote,
  SideMenuController,
  AddBlockButton,
  SideMenu,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/shadcn"
import type { Block, PartialBlock } from "@blocknote/core"
import { filterSuggestionItems } from "@blocknote/core/extensions"
import { zh } from "@blocknote/core/locales"
import type { MediaEntityType } from "@/lib/media-storage"
import { Button } from "@/components/ui/button"
import { StaticFormattingToolbar } from "./StaticFormattingToolbar"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

import "@blocknote/core/fonts/inter.css"
import "@blocknote/shadcn/style.css"

/** 侧边栏：只保留 "+" 添加按钮，不含拖拽手柄 */
function AddOnlySideMenu() {
  return (
    <SideMenu>
      <AddBlockButton />
    </SideMenu>
  )
}

export interface BlockNoteEditorProps {
  value: Block[] | null
  onChange: (blocks: Block[]) => void
  placeholder?: string
  minHeight?: string
  entityType?: MediaEntityType
  entityId?: string
}

const HIDDEN_SLASH_MENU_KEYS = new Set([
  "code_block",
  "table",
  "video",
  "audio",
])

function createUploadFile(entityType?: MediaEntityType, entityId?: string) {
  return async (file: File): Promise<string> => {
    if (entityType && entityId) {
      const formData = new FormData()
      formData.set("file", file)
      formData.set("entityType", entityType)
      formData.set("entityId", entityId)
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 45_000)
      try {
        const res = await fetch("/api/media", {
          method: "POST",
          credentials: "include",
          body: formData,
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || "Upload failed")
        }
        if (typeof data?.url !== "string" || !data.url) {
          throw new Error("Upload response did not include a file URL")
        }
        return data.url
      } finally {
        window.clearTimeout(timeout)
      }
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Read failed"))
      reader.readAsDataURL(file)
    })
  }
}

export function BlockNoteEditor({
  value,
  onChange,
  placeholder,
  minHeight = "640px",
  entityType,
  entityId,
}: BlockNoteEditorProps) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const placeholderText = placeholder ?? t("开始写作…", "Start writing…")
  const { resolvedTheme } = useTheme()
  const editorTheme = resolvedTheme === "dark" ? "dark" : "light"

  const uploadFile = useMemo(
    () => createUploadFile(entityType, entityId),
    [entityType, entityId],
  )
  const dictionary = useMemo(
    () => ({
      ...zh,
      placeholders: {
        ...zh.placeholders,
        default: placeholderText,
      },
    }),
    [placeholderText],
  )
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)
  const minZoom = 0.8
  const maxZoom = 1.6
  const zoomStep = 0.1

  const editor = useCreateBlockNote({
    initialContent: value && value.length > 0
      ? (value as PartialBlock[])
      : undefined,
    uploadFile,
    dictionary,
  })
  const getSlashMenuItems = useMemo(
    () => async (query: string) => {
      const items = getDefaultReactSlashMenuItems(editor).filter(
        (item) => !HIDDEN_SLASH_MENU_KEYS.has((item as unknown as { key: string }).key),
      )
      return filterSuggestionItems(items, query)
    },
    [editor],
  )

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.style.overflow = fullscreen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [fullscreen])

  const zoomPercent = Math.round(zoom * 100)
  const scaledWidth = `${100 / zoom}%`

  const renderShell = (
    shellClassName: string,
    shellHeight?: string,
  ) => (
    <div
      className={`${shellClassName} flex flex-col`}
      style={shellHeight ? { height: shellHeight } : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("缩放", "Zoom")}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoom((prev) => Math.max(minZoom, +(prev - zoomStep).toFixed(2)))}
              aria-label={t("缩小编辑器", "Zoom out editor")}
            >
              -
            </Button>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={zoomStep}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-2 w-28 accent-foreground"
              aria-label={t("调整编辑器缩放比例", "Adjust editor zoom")}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setZoom((prev) => Math.min(maxZoom, +(prev + zoomStep).toFixed(2)))}
              aria-label={t("放大编辑器", "Zoom in editor")}
            >
              +
            </Button>
          </div>
          <span className="w-12 text-right tabular-nums">{zoomPercent}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom(1)}
          >
            {t("重置", "Reset")}
          </Button>
          <Button
            type="button"
            variant={fullscreen ? "default" : "outline"}
            size="sm"
            onClick={() => setFullscreen((prev) => !prev)}
          >
            {fullscreen ? t("退出全屏", "Exit Fullscreen") : t("全屏编辑", "Fullscreen")}
          </Button>
        </div>
      </div>
      <div className="shrink-0">
        <StaticFormattingToolbar editor={editor} />
      </div>
      <div className="flex-1 min-h-0 overflow-auto blocknote-scroll">
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${zoom})`,
            width: scaledWidth,
          }}
        >
          <BlockNoteView
            editor={editor}
            onChange={() => onChange(editor.document as Block[])}
            theme={editorTheme}
            formattingToolbar={false}
            sideMenu={false}
            slashMenu={false}
            data-theming-css-variables-demo
          >
            <SideMenuController sideMenu={AddOnlySideMenu} />
            <SuggestionMenuController triggerCharacter="/" getItems={getSlashMenuItems} />
          </BlockNoteView>
        </div>
      </div>
    </div>
  )

  const inlineShell = renderShell(
    "rounded-lg border border-border bg-background overflow-hidden blocknote-wrapper blocknote-shell",
    minHeight,
  )
  const fullscreenShell = renderShell(
    "bg-background overflow-hidden blocknote-wrapper blocknote-shell blocknote-shell-full",
  )

  if (fullscreen && typeof document !== "undefined") {
    return createPortal(
      <div className="blocknote-overlay">
        {fullscreenShell}
      </div>,
      document.body,
    )
  }

  return inlineShell
}
