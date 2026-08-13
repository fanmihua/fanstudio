"use client"

import { useRef, useState, useCallback, useMemo } from "react"

interface GlowBorderProps {
  children: React.ReactNode
  className?: string
  borderWidth?: number
  glowSize?: number
  disabled?: boolean
}

/** 渐变色从 CSS 变量读取，通过 getComputedStyle 获取当前主题色。 */
function getGradientColors(): string {
  if (typeof window === "undefined") return "#D52D00, #EF7627, #FF9A56, #D162A4, #B55690, #A30262"
  const s = getComputedStyle(document.documentElement)
  const colors = [1, 2, 3, 5, 6, 7].map(
    (i) => s.getPropertyValue(`--color-pride-${i}`).trim() || "#888",
  )
  return colors.join(", ")
}

export function GlowBorder({
  children,
  className = "",
  borderWidth = 1.5,
  glowSize = 300,
  disabled = false,
}: GlowBorderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const gradientColors = useMemo(() => getGradientColors(), [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!ref.current || disabled) return
      const rect = ref.current.getBoundingClientRect()
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    },
    [disabled]
  )

  const handleMouseEnter = useCallback(() => {
    if (!disabled) setIsHovered(true)
  }, [disabled])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative ${className}`}
    >
      {/* Card content — rendered first, no wrapper so flex/grid layouts work directly */}
      {children}

      {/* Pride gradient border ring — rendered AFTER content + z-10 so it always paints on top of cover images */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-300 z-10"
        style={{
          opacity: isHovered ? 1 : 0,
          padding: borderWidth,
          background: `radial-gradient(${glowSize}px circle at ${position.x}px ${position.y}px, ${gradientColors}, transparent 60%)`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Inner spotlight glow — subtle fill behind content */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${glowSize * 0.8}px circle at ${position.x}px ${position.y}px, color-mix(in srgb, var(--color-pride-5) 4%, transparent), transparent 50%)`,
        }}
      />
    </div>
  )
}
