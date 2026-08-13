"use client"

/** 点赞按钮（轻量）：localStorage 记忆是否已赞 + 乐观更新，POST /api/likes ±1。可放在卡片链接内（已阻止冒泡）。 */
import { useEffect, useState, type MouseEvent } from "react"

const storeKey = (type: string, id: string) => `fanstudio:liked:${type}:${id}`

export function LikeButton({
  entityType,
  entityId,
  initialCount,
  size = "sm",
  overlay = false,
  className = "",
}: {
  entityType: "post" | "work" | "tutorial"
  entityId: string
  initialCount?: number
  size?: "sm" | "md"
  /** 浮在封面图上时用磨砂深色样式 */
  overlay?: boolean
  className?: string
}) {
  const [count, setCount] = useState(Math.max(0, initialCount ?? 0))
  const [liked, setLiked] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(storeKey(entityType, entityId)) === "1")
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, [entityType, entityId])

  async function toggle(e: MouseEvent) {
    // 卡片整体是链接，阻止点赞触发跳转
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    const next = !liked
    setLiked(next)
    setCount((c) => Math.max(0, c + (next ? 1 : -1)))
    setBusy(true)
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, action: next ? "like" : "unlike" }),
      })
      if (res.ok) {
        const d = await res.json().catch(() => null)
        if (d && typeof d.count === "number") setCount(Math.max(0, d.count))
        try {
          if (next) localStorage.setItem(storeKey(entityType, entityId), "1")
          else localStorage.removeItem(storeKey(entityType, entityId))
        } catch {
          /* 忽略 */
        }
      } else {
        setLiked(!next) // 回滚
        setCount((c) => Math.max(0, c + (next ? -1 : 1)))
      }
    } catch {
      setLiked(!next)
      setCount((c) => Math.max(0, c + (next ? -1 : 1)))
    } finally {
      setBusy(false)
    }
  }

  const sizeCls = size === "md" ? "gap-1.5 px-3 py-1.5 text-sm" : "gap-1 px-2 py-1 text-xs"
  const stateCls = overlay
    ? liked
      ? "border-white/30 bg-rose-500/90 text-white shadow-sm backdrop-blur-md"
      : "border-white/25 bg-black/40 text-white shadow-sm backdrop-blur-md hover:bg-black/55"
    : liked
      ? "border-rose-300/60 bg-rose-50 text-rose-500 dark:border-rose-500/30 dark:bg-rose-500/10"
      : "border-border bg-background/60 text-muted-foreground hover:border-rose-300/60 hover:text-rose-500"
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "取消点赞" : "点赞"}
      className={`inline-flex items-center rounded-full border transition-colors ${sizeCls} ${stateCls} ${className}`}
    >
      <i className={liked ? "ri-heart-3-fill" : "ri-heart-3-line"} />
      <span className="tabular-nums">{count}</span>
    </button>
  )
}
