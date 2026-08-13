"use client"
/** 卡片内描述：渲染后台富文本 HTML，保留加粗/斜体等样式，用于列表卡片摘要。 */
import { cn } from "@/lib/utils"

interface CardDescriptionHtmlProps {
  html: string | null | undefined
  className?: string
  /** 行数限制，默认 2；设为 false 不限制行数（如侧栏完整描述） */
  lines?: number | false
}

/**
 * 将后台保存的 HTML 描述在卡片内正确显示（加粗、斜体等）。
 * 内容来自本站后台，仅用于展示。
 */
export function CardDescriptionHtml({
  html,
  className,
  lines = 2,
}: CardDescriptionHtmlProps) {
  if (html == null || typeof html !== "string" || !html.trim()) return null

  const lineClampClass =
    lines === false ? "" : lines === 3 ? "line-clamp-3" : "line-clamp-2"

  return (
    <div
      className={cn(
        "text-sm text-muted-foreground break-words",
        lineClampClass,
        "[&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic [&_i]:italic [&_s]:line-through",
        "[&_code]:bg-accent [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs",
        "[&_p]:my-0 [&_p]:leading-relaxed [&_p:not(:last-child)]:mb-1",
        "[&_ul]:my-0.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-0.5 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0 [&_li]:pl-0.5",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:my-1 [&_blockquote]:italic [&_blockquote]:text-muted-foreground/90",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
