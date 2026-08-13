"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { LineSidebar, type LineSidebarItem } from "@/components/react-bits"

type ArticleOutlineProps = {
  headings: Array<{ id: string; text: string; level: number }>
  locale: "zh" | "en"
  mode: "desktop" | "mobile"
}

export function ArticleOutline({ headings, locale, mode }: ArticleOutlineProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [interacting, setInteracting] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const [gestureIndex, setGestureIndex] = useState<number | null>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  const openedAtRef = useRef(0)
  const gestureRef = useRef({
    pointerId: -1,
    index: 0,
    startX: 0,
    startY: 0,
    moved: false,
    wasOpen: false,
  })
  const label = locale === "en" ? "On this page" : "本文目录"

  useEffect(() => {
    let frame = 0

    const updateActiveHeading = () => {
      frame = 0
      const activationLine = Math.min(180, window.innerHeight * 0.24)
      let nextIndex = 0

      headings.forEach((heading, index) => {
        const element = document.getElementById(heading.id)
        if (element && element.getBoundingClientRect().top <= activationLine) nextIndex = index
      })

      setActiveIndex(nextIndex)
    }

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveHeading)
    }

    updateActiveHeading()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [headings])

  const jumpToHeading = useCallback((index: number, item: LineSidebarItem) => {
    const element = document.getElementById(item.id)
    if (!element) return
    setActiveIndex(index)
    element.scrollIntoView({ behavior: "smooth", block: "start" })
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${item.id}`)
  }, [])

  const items: LineSidebarItem[] = headings.map((heading) => ({
    id: heading.id,
    label: heading.text,
    level: heading.level,
  }))

  useEffect(() => {
    if (!pinnedOpen) return

    const closeWhenTouchingOutside = (event: PointerEvent) => {
      if (railRef.current?.contains(event.target as Node)) return
      setPinnedOpen(false)
      setGestureIndex(null)
    }

    document.addEventListener("pointerdown", closeWhenTouchingOutside)
    return () => document.removeEventListener("pointerdown", closeWhenTouchingOutside)
  }, [pinnedOpen])

  useEffect(() => {
    if (!pinnedOpen || gestureIndex === null) return
    const frame = window.requestAnimationFrame(() => {
      rowRefs.current[gestureIndex]?.scrollIntoView({ block: "nearest" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [gestureIndex, pinnedOpen])

  if (headings.length < 2) return null

  const visibleIndex = gestureIndex ?? activeIndex
  const expanded = interacting || pinnedOpen

  if (mode === "desktop") {
    return (
      <aside className="hidden xl:block min-w-0" aria-label={label}>
        <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain px-2 pb-6">
          <p className="mb-3 pl-[54px] text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <LineSidebar items={items} activeIndex={activeIndex} onItemClick={jumpToHeading} />
        </div>
      </aside>
    )
  }

  const updateGestureIndex = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail || event.pointerId !== gestureRef.current.pointerId) return

    const rect = rail.getBoundingClientRect()
    const relativeY = Math.max(0, Math.min(rect.height - 1, event.clientY - rect.top))
    const index = Math.min(items.length - 1, Math.floor((relativeY / rect.height) * items.length))
    gestureRef.current.index = index
    setGestureIndex(index)
  }

  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== gestureRef.current.pointerId) return
    const distance = Math.hypot(
      event.clientX - gestureRef.current.startX,
      event.clientY - gestureRef.current.startY,
    )
    if (distance >= 8) gestureRef.current.moved = true
    updateGestureIndex(event)
  }

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== gestureRef.current.pointerId) return
    const { index, moved, wasOpen } = gestureRef.current
    setInteracting(false)
    gestureRef.current.pointerId = -1

    if (!wasOpen && !moved) {
      openedAtRef.current = event.timeStamp
      setPinnedOpen(true)
      setGestureIndex(index)
      return
    }

    setPinnedOpen(false)
    setGestureIndex(null)
    jumpToHeading(index, items[index])
  }

  const selectExpandedItem = (index: number, item: LineSidebarItem) => {
    setPinnedOpen(false)
    setGestureIndex(null)
    jumpToHeading(index, item)
  }

  const handleExpandedItemKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    index: number,
    item: LineSidebarItem,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    event.stopPropagation()
    selectExpandedItem(index, item)
  }

  const railStyle = {
    left: "max(0px, env(safe-area-inset-left))",
    "--outline-collapsed-row-height": `min(24px, calc((100dvh - 160px) / ${items.length}))`,
  } as CSSProperties

  return (
    <div className="xl:hidden">
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label={locale === "en" ? "Article section navigator" : "文章章节导航"}
        aria-valuemin={1}
        aria-valuemax={items.length}
        aria-valuenow={visibleIndex + 1}
        aria-valuetext={items[visibleIndex]?.label}
        onPointerDown={(event) => {
          if (pinnedOpen) return
          gestureRef.current = {
            pointerId: event.pointerId,
            index: activeIndex,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
            wasOpen: pinnedOpen,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          setInteracting(true)
          setGestureIndex(activeIndex)
          updateGestureIndex(event)
        }}
        onPointerMove={(event) => {
          if (!pinnedOpen) moveGesture(event)
        }}
        onPointerUp={(event) => {
          if (!pinnedOpen) finishGesture(event)
        }}
        onPointerCancel={() => {
          setInteracting(false)
          setGestureIndex(pinnedOpen ? gestureRef.current.index : null)
          gestureRef.current.pointerId = -1
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setPinnedOpen(false)
            setGestureIndex(null)
            return
          }
          if (pinnedOpen) return
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
          event.preventDefault()
          const direction = event.key === "ArrowDown" ? 1 : -1
          const nextIndex = Math.max(0, Math.min(items.length - 1, activeIndex + direction))
          jumpToHeading(nextIndex, items[nextIndex])
        }}
        className={`fixed top-1/2 z-[60] -translate-y-1/2 select-none py-1.5 transition-[width,background-color,border-color,box-shadow,border-radius] duration-150 ease-out ${
          expanded
            ? `max-h-[calc(100dvh-160px)] w-[min(calc(100vw-16px),340px)] rounded-r-2xl border-y border-r border-border bg-background/97 shadow-xl backdrop-blur-sm ${
                pinnedOpen ? "touch-pan-y overflow-y-auto overscroll-contain" : "touch-none overflow-hidden"
              }`
            : "w-7 touch-none overflow-hidden"
        }`}
        style={railStyle}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            ref={(element) => { rowRefs.current[index] = element }}
            role={pinnedOpen ? "button" : undefined}
            tabIndex={pinnedOpen ? 0 : -1}
            aria-current={activeIndex === index ? "location" : undefined}
            onClick={(event) => {
              if (event.timeStamp - openedAtRef.current < 250) return
              if (pinnedOpen) selectExpandedItem(index, item)
            }}
            onKeyDown={(event) => {
              if (pinnedOpen) handleExpandedItemKeyDown(event, index, item)
            }}
            className={`flex items-center gap-2 transition-[height,background-color] ${
              expanded && index === visibleIndex ? "bg-accent" : ""
            } ${pinnedOpen ? "h-11 cursor-pointer px-2 hover:bg-accent" : interacting ? "h-11 px-2" : "h-[var(--outline-collapsed-row-height)] pl-1"}`}
          >
            {expanded ? (
              <>
                <span className="w-7 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground opacity-70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm ${index === visibleIndex ? "text-foreground" : "text-muted-foreground opacity-70"}`}>
                  {item.label}
                </span>
              </>
            ) : null}
            <span className={`order-first flex shrink-0 justify-start ${expanded ? "w-6" : "w-full"}`}>
              <span
                aria-hidden="true"
                className="block h-0.5 rounded-full transition-[width,opacity,background] duration-150"
                style={{
                  width: index === visibleIndex ? "22px" : "12px",
                  opacity: index === visibleIndex ? 1 : 0.34,
                  background: index === visibleIndex ? "var(--pride-gradient-h)" : "var(--foreground)",
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
