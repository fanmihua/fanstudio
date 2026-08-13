"use client"

import { useEffect, useRef, useState } from "react"

/** 数字滚动：0 → target，ease-out cubic，约 1.4s。target 为 null 时停在 0。 */
function useCountUp(target: number | null, duration = 1400): number {
  const [val, setVal] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    if (target == null) return
    const startVal = 0
    let startTs = 0
    const step = (ts: number) => {
      if (!startTs) startTs = ts
      const t = Math.min(1, (ts - startTs) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(startVal + (target - startVal) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])
  return val
}

/**
 * 站点统计徽标：「X 人访问 · Y 人通行」，顶部居中用。挂载时 POST /api/stats（计一次访问 + 取数）→ 滚动动画。
 * 本身是 inline-flex 的 pill，居中交给父层。className 可覆盖配色以适配不同页面主题。
 */
export function SiteStatBadge({ className = "" }: { className?: string }) {
  const [stats, setStats] = useState<{ visits: number; passes: number } | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/stats", { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (alive) setStats({ visits: Number(d.visits) || 0, passes: Number(d.passes) || 0 })
      })
      .catch(() => {
        if (alive) setHidden(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const visits = useCountUp(stats ? stats.visits : null)
  const passes = useCountUp(stats ? stats.passes : null)

  if (hidden) return null

  return (
    <div className={`inline-flex items-center gap-3 text-sm text-muted-foreground ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <i className="ri-eye-line text-base text-muted-foreground" aria-hidden />
        <b className="font-semibold tabular-nums text-foreground">{visits.toLocaleString()}</b>
        <span>人访问</span>
      </span>
      <span className="h-3.5 w-px bg-border" aria-hidden />
      <span className="inline-flex items-center gap-1.5">
        <i className="ri-vip-crown-2-line text-base text-[#EF7627]" aria-hidden />
        <b className="font-semibold tabular-nums text-foreground">{passes.toLocaleString()}</b>
        <span>人通行</span>
      </span>
    </div>
  )
}
