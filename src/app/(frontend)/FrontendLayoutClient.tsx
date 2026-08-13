"use client"
/** 前台布局客户端：侧栏宽度、主题、设置 Provider、底部导航、滚动进度。 */
import { useState, useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { BottomNav } from "@/components/frontend/bottom-nav"
import { MagazineSidebar } from "@/components/frontend/MagazineSidebar"
import { ScrollProgress } from "@/components/ui/ScrollProgress"
import { CustomCursor } from "@/components/ui/CustomCursor"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeColorProvider } from "@/components/ThemeColorProvider"
import { FrontendSettingsProvider } from "@/contexts/FrontendSettingsContext"
import type { FrontendSettings } from "@/lib/settings-server"
import { SiteAIAssistant } from "@/components/frontend/SiteAIAssistant"
import { SiteFooter } from "@/components/frontend/SiteFooter"

const STORAGE_KEY = "frontend-sidebar-width"
const MIN_WIDTH = 160
const MAX_WIDTH = 320
const DEFAULT_WIDTH = 200

export default function FrontendLayoutClient({
  initial,
  children,
}: {
  initial: FrontendSettings
  children: React.ReactNode
}) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const w = parseInt(stored, 10)
        if (w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    fetch("/api/locale", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: initial.locale }),
    }).catch(() => {})
  }, [initial.locale])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = true
    setIsDragging(true)

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      dragRef.current = false
      setIsDragging(false)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }, [])

  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem(STORAGE_KEY, String(sidebarWidth))
    }
  }, [isDragging, sidebarWidth])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      storageKey="frontend-theme"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorProvider initial={initial.theme}>
      <FrontendSettingsProvider initial={initial}>
        <div className="relative min-h-screen bg-background transition-colors duration-300">
          <ScrollProgress />
          <CustomCursor />
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 grid-bg opacity-20 z-0" />
          </div>
          <MagazineSidebar width={sidebarWidth} />
          {/* Drag handle — desktop only */}
          <div
            className={cn(
              "hidden lg:block fixed top-0 bottom-0 z-50 w-1 cursor-col-resize transition-colors",
              isDragging ? "bg-primary/30" : "hover:bg-primary/20"
            )}
            style={{ left: sidebarWidth - 2 }}
            onMouseDown={handleMouseDown}
          />
          <main
            className="relative z-10"
            style={{
              marginLeft: undefined,
              transition: isDragging ? "none" : "margin-left 200ms",
            }}
          >
            {/* lg breakpoint: use sidebar width as margin */}
            <style>{`@media (min-width: 1024px) { .frontend-main-with-sidebar { margin-left: ${sidebarWidth}px; } }`}</style>
            <div className="frontend-main-with-sidebar min-w-0 [overflow-x:clip]">
              {children}
              <SiteFooter />
            </div>
          </main>
          <div className="lg:hidden">
            <BottomNav />
          </div>
          <SiteAIAssistant />
        </div>
      </FrontendSettingsProvider>
      </ThemeColorProvider>
    </ThemeProvider>
  )
}
