"use client"

import { useState, useRef, useCallback } from "react"
import type { MediaEntityType } from "@/lib/media-storage"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export interface CoverImageUploadProps {
  value: string
  onChange: (url: string) => void
  entityType: MediaEntityType
  entityId: string
  /** CSS aspect-ratio value, e.g. "16/9" or "4/3" */
  aspectRatio?: string
  /** 推荐比例提示文字 */
  recommendText?: string
}

export function CoverImageUpload({
  value,
  onChange,
  entityType,
  entityId,
  aspectRatio = "3/4",
  recommendText = "建议按当前比例上传，如 1200x1600",
}: CoverImageUploadProps) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(t("仅支持 JPG、PNG、WebP、GIF 格式", "Only JPG, PNG, WebP, and GIF are supported"))
        return
      }
      if (file.size > MAX_SIZE) {
        setError(t("文件大小不能超过 5 MB", "File size must be less than 5 MB"))
        return
      }
      setError("")
      setUploading(true)
      try {
        const formData = new FormData()
        formData.set("file", file)
        formData.set("entityType", entityType)
        formData.set("entityId", entityId)
        const res = await fetch("/api/media", {
          method: "POST",
          credentials: "include",
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error || t("上传失败", "Upload failed"))
          return
        }
        if (data?.url) {
          onChange(data.url)
        }
      } catch {
        setError(t("网络错误，请重试", "Network error, please try again"))
      } finally {
        setUploading(false)
      }
    },
    [entityType, entityId, onChange],
  )

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload(file)
    // 重置 input 以允许再次选同一文件
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) upload(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  const localizedRecommendText = locale === "en" ? "Recommended ratio follows current setting, e.g. 1200x1600" : recommendText
  const hintText = locale === "en"
    ? `${localizedRecommendText} · JPG/PNG/WebP/GIF · Max 5MB`
    : `${localizedRecommendText} · 支持 JPG/PNG/WebP/GIF · 最大 5MB`

  // 有封面图 — 预览模式
  if (value) {
    return (
      <div className="space-y-2 w-full">
        <div
          className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-muted/30 group"
          style={{ aspectRatio }}
        >
          <img
            src={value}
            alt={t("封面图预览", "Cover preview")}
            className="w-full h-full object-cover"
          />
          {/* hover 遮罩 + 操作按钮 */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-white/90 text-sm font-medium text-gray-800 hover:bg-white transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              <i className="ri-image-edit-line mr-1" />
              {t("更换", "Replace")}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-white/90 text-sm font-medium text-red-600 hover:bg-white transition-colors"
              onClick={() => onChange("")}
            >
              <i className="ri-delete-bin-line mr-1" />
              {t("移除", "Remove")}
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground/70">{hintText}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // 无封面图 — 上传区域
  return (
    <div className="space-y-2 w-full">
      <div
        className={`
          relative w-full overflow-hidden rounded-xl border-2 border-dashed
          ${uploading ? "border-muted-foreground/30 bg-muted/20" : "border-border hover:border-muted-foreground/40 hover:bg-muted/20"}
          transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 px-4 py-8
        `}
        style={{ aspectRatio }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {uploading ? (
          <>
            <i className="ri-loader-4-line text-2xl text-muted-foreground animate-spin" />
            <span className="text-sm text-muted-foreground">{t("上传中…", "Uploading…")}</span>
          </>
        ) : (
          <>
            <i className="ri-image-add-line text-3xl text-muted-foreground/60" />
            <span className="text-sm text-muted-foreground">
              {t("点击或拖拽图片到此处上传", "Click or drag image here to upload")}
            </span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-xs text-muted-foreground/70">{hintText}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
