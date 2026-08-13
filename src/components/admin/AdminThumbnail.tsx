"use client"
/** 后台列表缩略图：无图或加载失败时显示占位图标。 */
import { useState } from "react"
import { cn } from "@/lib/utils"

export function AdminThumbnail({
  src,
  fallbackIcon,
  className,
}: {
  src?: string | null
  fallbackIcon: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const hasImage = src && src !== "/placeholder.svg" && !failed

  if (hasImage) {
    return (
      <div className={cn("rounded-lg overflow-hidden bg-muted shrink-0", className)}>
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </div>
    )
  }

  return (
    <div className={cn("rounded-lg bg-accent flex items-center justify-center shrink-0", className)}>
      <i className={`${fallbackIcon} text-base text-muted-foreground`} />
    </div>
  )
}
