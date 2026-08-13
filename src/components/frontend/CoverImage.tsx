"use client"
/** 前台封面图：无图或加载失败时显示占位图标。 */
import { useState } from "react"

interface CoverImageProps {
  src: string | null | undefined
  alt: string
  fallbackIcon?: string
  className?: string
}

export function CoverImage({
  src,
  alt,
  fallbackIcon = "ri-image-line",
  className = "",
}: CoverImageProps) {
  const [failed, setFailed] = useState(false)

  const hasImage = src && src !== "/placeholder.svg" && !failed

  if (hasImage) {
    return (
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover ${className}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-accent to-muted flex items-center justify-center">
      <i className={`${fallbackIcon} text-2xl text-muted-foreground/50`} />
    </div>
  )
}
