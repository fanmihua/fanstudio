"use client"
/**
 * 悬浮触发的 Popover：
 * - 桌面端：鼠标悬浮显示，移出隐藏，trigger 与 content 间移动保持显示。
 * - 移动端：点击切换显示/隐藏，点击外部区域关闭。
 */
import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function HoverPopover({
  children,
  content,
  side = "top",
  align = "center",
}: {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
}) {
  const [hydrated, setHydrated] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(null)
  const touchedRef = React.useRef(false)

  React.useEffect(() => {
    const raf = window.requestAnimationFrame(() => setHydrated(true))
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const handleEnter = React.useCallback(() => {
    if (touchedRef.current) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(true)
  }, [])

  const handleLeave = React.useCallback(() => {
    if (touchedRef.current) return
    timeoutRef.current = setTimeout(() => setOpen(false), 150)
  }, [])

  /** 移动端：touchEnd 切换开关，阻止后续模拟鼠标事件 */
  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    touchedRef.current = true
    setOpen((prev) => !prev)
  }, [])

  if (!hydrated) {
    return <span className="inline-flex items-center">{children}</span>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onTouchEnd={handleTouchEnd}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className="inline-flex items-center"
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        side={side}
        align={align}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
