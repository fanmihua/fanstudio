"use client"
/** 图片画廊组件：等比缩放展示 + 点击全屏查看 + 左右切换。 */
import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { detectLocaleFromPath } from "@/lib/i18n-path"

interface ImageGalleryProps {
  images: string[]
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const pathname = usePathname()
  const locale = detectLocaleFromPath(pathname || "/")
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const openLightbox = useCallback((index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
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

  if (images.length === 0) return null

  return (
    <>
      {/* 图片列表 - 等比缩放 */}
      <div className="flex flex-col gap-4 min-w-0">
        {images.map((url, index) => (
          <button
            key={index}
            type="button"
            onClick={() => openLightbox(index)}
            className="w-full min-w-0 rounded-xl border border-border bg-card/50 overflow-hidden cursor-zoom-in
              hover:border-primary/30 transition-colors group relative"
          >
            <Image
              src={url}
              unoptimized
              alt={t(`图片 ${index + 1}`, `Image ${index + 1}`)}
              width={1200}
              height={800}
              className="w-full h-auto object-contain"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 45vw"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
              <i className="ri-zoom-in-line text-2xl text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </button>
        ))}
      </div>

      {/* 全屏灯箱 */}
      {lightboxOpen && (
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
      )}
    </>
  )
}
