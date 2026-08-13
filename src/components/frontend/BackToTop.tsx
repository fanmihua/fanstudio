"use client"

/**
 * 一键返回顶部：滚动超过一屏后浮现，点击平滑回顶。
 * 通过 portal 渲染到 document.body，避开前台 <main className="relative z-10"> 造成的层叠上下文陷阱
 * （否则会被 z-40 的左侧栏盖住）；定位在右下角、AI 助手启动按钮上方，各断点均不重叠。
 */
import { useEffect, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { detectLocaleFromPath } from "@/lib/i18n-path"

const subscribeToDOM = () => () => {}

export function BackToTop() {
  const pathname = usePathname()
  const isEn = detectLocaleFromPath(pathname || "/") === "en"
  const mounted = useSyncExternalStore(subscribeToDOM, () => true, () => false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!mounted) return null

  return createPortal(
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={isEn ? "Back to top" : "返回顶部"}
      className={`fixed right-4 bottom-40 lg:bottom-20 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition-all duration-300 hover:bg-accent ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <i className="ri-arrow-up-line text-lg" />
    </button>,
    document.body,
  )
}
