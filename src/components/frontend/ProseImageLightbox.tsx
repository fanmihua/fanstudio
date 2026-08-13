"use client"
/**
 * 为 prose 正文区域中的图片添加点击全屏灯箱查看功能。
 * 用法：包裹 dangerouslySetInnerHTML 的容器即可。
 */
import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { detectLocaleFromPath } from "@/lib/i18n-path"

interface ProseImageLightboxProps {
  children: React.ReactNode
}

export function ProseImageLightbox({ children }: ProseImageLightboxProps) {
  const pathname = usePathname()
  const locale = detectLocaleFromPath(pathname || "/")
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const containerRef = useRef<HTMLDivElement>(null)
  const [images, setImages] = useState<string[]>([])
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  /** 扫描容器内所有 img，收集 src 并绑定点击 */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const imgElements = container.querySelectorAll<HTMLImageElement>("img")
    imgElements.forEach((img) => {
      img.style.cursor = "zoom-in"
    })

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.tagName !== "IMG") return
      const currentImages = Array.from(container.querySelectorAll<HTMLImageElement>("img"))
        .map((img) => img.getAttribute("src"))
        .filter((src): src is string => Boolean(src))
      const src = target.getAttribute("src")
      if (!src) return
      const idx = currentImages.indexOf(src)
      if (idx === -1) return
      e.preventDefault()
      e.stopPropagation()
      setImages(currentImages)
      setCurrentIndex(idx)
      setLightboxOpen(true)
    }

    container.addEventListener("click", handleClick)
    return () => container.removeEventListener("click", handleClick)
  }, [])

  const closeLightbox = useCallback(() => setLightboxOpen(false), [])

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }, [images.length])

  /** 键盘导航 */
  useEffect(() => {
    if (!lightboxOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox()
      else if (e.key === "ArrowLeft") goToPrev()
      else if (e.key === "ArrowRight") goToNext()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [lightboxOpen, closeLightbox, goToPrev, goToNext])

  /** 禁止全屏时 body 滚动 */
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [lightboxOpen])

  const lightbox = lightboxOpen && images.length > 0 && (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 sm:p-10"
      style={{ overflow: "hidden" }}
      onClick={closeLightbox}
    >
      {/* 计数器 */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/70 text-sm font-medium
          bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* 左箭头 */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goToPrev() }}
          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10
            rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors
            flex items-center justify-center"
        >
          <i className="ri-arrow-left-s-line text-xl" />
        </button>
      )}

      {/* 右箭头 */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); goToNext() }}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10
            rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors
            flex items-center justify-center"
        >
          <i className="ri-arrow-right-s-line text-xl" />
        </button>
      )}

      {/* 图片 - 点击图片不关闭 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={images[currentIndex]}
        src={images[currentIndex]}
        alt={t(`图片 ${currentIndex + 1}`, `Image ${currentIndex + 1}`)}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        className="select-none"
        draggable={false}
      />
    </div>
  )

  return (
    <>
      <div ref={containerRef}>{children}</div>
      {typeof document !== "undefined" && lightbox && createPortal(lightbox, document.body)}
    </>
  )
}
