"use client"

import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react"

export type LineSidebarItem = {
  id: string
  label: string
  level?: number
}

type Falloff = "linear" | "smooth" | "sharp"

type LineSidebarProps = {
  items: LineSidebarItem[]
  activeIndex?: number
  showIndex?: boolean
  proximityRadius?: number
  markerLength?: number
  itemGap?: number
  falloff?: Falloff
  onItemClick?: (index: number, item: LineSidebarItem) => void
  className?: string
}

const falloffCurves: Record<Falloff, (progress: number) => number> = {
  linear: (progress) => progress,
  smooth: (progress) => progress * progress * (3 - 2 * progress),
  sharp: (progress) => progress * progress * progress,
}

function applyLineEffect(element: HTMLLIElement, value: number) {
  const effect = Math.max(0, Math.min(1, value))
  element.style.setProperty("--line-effect", effect.toFixed(4))
  element.style.setProperty("--line-scale", (0.72 + effect * 0.38).toFixed(4))
  element.style.setProperty("--line-opacity", (0.46 + effect * 0.54).toFixed(4))
}

export function LineSidebar({
  items,
  activeIndex = 0,
  showIndex = true,
  proximityRadius = 92,
  markerLength = 30,
  itemGap = 14,
  falloff = "smooth",
  onItemClick,
  className = "",
}: LineSidebarProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])

  useEffect(() => {
    itemRefs.current.forEach((element, index) => {
      if (element) applyLineEffect(element, index === activeIndex ? 1 : 0)
    })
  }, [activeIndex])

  const handlePointerMove = (event: PointerEvent<HTMLUListElement>) => {
    if (event.pointerType === "touch") return
    const list = listRef.current
    if (!list) return
    const pointerY = event.clientY - list.getBoundingClientRect().top
    const curve = falloffCurves[falloff]

    itemRefs.current.forEach((element, index) => {
      if (!element) return
      const center = element.offsetTop + element.offsetHeight / 2
      const proximity = curve(Math.max(0, 1 - Math.abs(pointerY - center) / proximityRadius))
      applyLineEffect(element, Math.max(proximity, index === activeIndex ? 1 : 0))
    })
  }

  const handlePointerLeave = () => {
    itemRefs.current.forEach((element, index) => {
      if (element) applyLineEffect(element, index === activeIndex ? 1 : 0)
    })
  }

  return (
    <nav aria-label="文章目录" className={className}>
      <ul
        ref={listRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="m-0 flex list-none flex-col py-2"
        style={{
          gap: `${itemGap}px`,
          paddingLeft: `${markerLength + 10}px`,
        }}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            ref={(element) => { itemRefs.current[index] = element }}
            aria-current={activeIndex === index ? "location" : undefined}
            className="group relative [--line-effect:0] [--line-opacity:.46] [--line-scale:.72]"
            style={{ transition: "opacity 120ms ease" } as CSSProperties}
          >
            <span
              aria-hidden="true"
              className="absolute right-[calc(100%+10px)] top-1/2 h-0.5 origin-right -translate-y-1/2 bg-border transition-transform duration-150 ease-out"
              style={{ width: `${markerLength}px`, transform: "translateY(-50%) scaleX(var(--line-scale))" }}
            >
              <span
                className="absolute inset-0 origin-right bg-foreground transition-opacity duration-150"
                style={{ opacity: "var(--line-effect)" }}
              />
            </span>
            {index < items.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute right-[calc(100%+10px)] h-0.5 origin-right bg-border/70 transition-transform duration-150"
                style={{
                  top: `calc(100% + ${itemGap / 2}px)`,
                  width: `${markerLength * 0.45}px`,
                  transform: "scaleX(var(--line-scale))",
                }}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onItemClick?.(index, item)}
              className={`grid w-full grid-cols-[1.75rem_minmax(0,1fr)] items-baseline text-left text-sm leading-snug text-foreground transition-opacity duration-150 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 ${item.level === 3 ? "text-[13px]" : ""}`}
              style={{ opacity: "var(--line-opacity)" }}
            >
              {showIndex ? (
                <span className="font-mono text-[10px] tabular-nums opacity-60">
                  {String(index + 1).padStart(2, "0")}
                </span>
              ) : null}
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
