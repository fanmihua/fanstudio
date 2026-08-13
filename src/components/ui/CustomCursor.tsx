"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeColor } from "@/components/ThemeColorProvider"

/** 从 CSS 变量读取当前主题的 6 色（跳过 pride-4 白色）。 */
function getThemeColors(): string[] {
  if (typeof window === "undefined") {
    return ["#D52D00", "#EF7627", "#FF9A56", "#D162A4", "#B55690", "#A30262"]
  }
  const s = getComputedStyle(document.documentElement)
  return [1, 2, 3, 5, 6, 7].map(
    (i) => s.getPropertyValue(`--color-pride-${i}`).trim() || "#888",
  )
}

const MAX_TRAIL = 20
const THROTTLE_MS = 35

interface TrailPoint {
  id: number
  x: number
  y: number
  color: string
}

export function CustomCursor() {
  const { themeConfig } = useThemeColor()
  const [isVisible, setIsVisible] = useState(false)
  const [trail, setTrail] = useState<TrailPoint[]>([])
  const colorIndexRef = useRef(0)
  const idCounterRef = useRef(0)
  const lastTimeRef = useRef(0)
  const colorsRef = useRef<string[]>(getThemeColors())

  useEffect(() => {
    colorsRef.current = getThemeColors()
    colorIndexRef.current = 0
  }, [themeConfig])

  const addPoint = useCallback((x: number, y: number) => {
    const now = Date.now()
    if (now - lastTimeRef.current < THROTTLE_MS) return
    lastTimeRef.current = now

    const colors = colorsRef.current
    const color = colors[colorIndexRef.current % colors.length]
    colorIndexRef.current += 1
    const id = idCounterRef.current++

    setTrail((prev) => {
      const next = [...prev, { id, x, y, color }]
      if (next.length > MAX_TRAIL) return next.slice(-MAX_TRAIL)
      return next
    })

    setTimeout(() => {
      setTrail((prev) => prev.filter((p) => p.id !== id))
    }, 800)
  }, [])

  useEffect(() => {
    const checkMobile = () => {
      const isMobile =
        window.matchMedia("(max-width: 768px)").matches ||
        "ontouchstart" in window
      setIsVisible(!isMobile)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (!isVisible) return

    const handleMove = (e: MouseEvent) => {
      addPoint(e.clientX, e.clientY)
    }

    window.addEventListener("mousemove", handleMove)
    return () => window.removeEventListener("mousemove", handleMove)
  }, [isVisible, addPoint])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <AnimatePresence>
        {trail.map((point) => (
          <motion.div
            key={point.id}
            className="absolute rounded-full"
            style={{
              left: point.x,
              top: point.y,
              width: 7,
              height: 7,
              backgroundColor: point.color,
              transform: "translate(-50%, -50%)",
            }}
            initial={{ opacity: 0.55, scale: 1 }}
            animate={{ opacity: 0, scale: 0.2 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
