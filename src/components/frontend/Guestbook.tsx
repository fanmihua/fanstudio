"use client"

/**
 * 「来坐坐」留言板：白色便签墙 + 纸纹质感。
 * 顶部仅一句欢迎语（重点留给留言墙）；便签为白纸 + 深墨字、圆角、无投影、无旋转，hover 出现卡片描边 + 微抬。
 * 写留言入口为常驻浮标「写便签」→ 弹窗写；浮标/弹窗用 portal 挂到 body 避开层叠陷阱。
 * 防滥用在服务端（蜜罐 / 限流 / 链接过滤）。
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { detectLocaleFromPath } from "@/lib/i18n-path"
import { useNavConfig } from "@/hooks/useNavConfig"
import { defaultPageCopy } from "@/lib/page-copy"

type Reply = {
  id: string
  nickname: string | null
  content: string
  isOwner: boolean
  createdAt: string
}
type Message = Reply & { replies: Reply[]; pinned: boolean }

const EMOJIS = [
  "😀", "😄", "😁", "🤣", "😊", "🥰", "😍", "😘",
  "🤗", "🤔", "😎", "🥳", "😅", "🙂", "😉", "🥺",
  "👍", "👏", "🙏", "💪", "🎉", "✨", "🔥", "💯",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "☕", "🌟",
  "🍀", "🌈", "🌸", "😭",
]

const NOTE_BG = "#ffffff" // 便签恒为白纸
const INK = "#3f3a33" // 墨字色

// 纸纹噪点（内联 SVG，极淡）
const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.05'/%3E%3C/svg%3E\")"

function timeAgo(iso: string, isEn: boolean): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return isEn ? "just now" : "刚刚"
  if (min < 60) return isEn ? `${min}m ago` : `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return isEn ? `${h}h ago` : `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return isEn ? `${d}d ago` : `${d} 天前`
  return new Date(iso).toLocaleDateString(isEn ? "en-US" : "zh-CN")
}

function firstChar(name: string): string {
  return [...name.trim()][0] || "☺"
}

/** 表情选择按钮。 */
function EmojiButton({ onPick, label }: { onPick: (e: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-black/5 hover:text-stone-700 transition-colors"
      >
        <i className="ri-emotion-happy-line text-lg" />
      </button>
      {open && (
        <div className="absolute bottom-11 left-0 z-30 w-64 rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onPick(e)
                  setOpen(false)
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-lg hover:bg-stone-100 transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Guestbook() {
  const pathname = usePathname()
  const isEn = detectLocaleFromPath(pathname || "/") === "en"
  const tr = (zh: string, en: string) => (isEn ? en : zh)
  const { pageCopy } = useNavConfig()

  const title = (isEn ? pageCopy.guestbookNameEn : pageCopy.guestbookName) || tr("来坐坐", "Pull Up a Chair")
  const greeting =
    (isEn
      ? pageCopy.guestbookGreetingEn || defaultPageCopy.guestbookGreetingEn
      : pageCopy.guestbookGreeting || defaultPageCopy.guestbookGreeting) || ""

  // 站长头像（仅用于「博主」留言/回复的小头像）
  const [hostAvatar, setHostAvatar] = useState("")
  useEffect(() => {
    fetch(`/api/settings?locale=${isEn ? "en" : "zh"}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHostAvatar(typeof d.avatar === "string" ? d.avatar : ""))
      .catch(() => {})
  }, [isEn])

  const [messages, setMessages] = useState<Message[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [nickname, setNickname] = useState("")
  const [content, setContent] = useState("")
  const [hp, setHp] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")

  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyNick, setReplyNick] = useState("")
  const [replyContent, setReplyContent] = useState("")
  const [replyPosting, setReplyPosting] = useState(false)
  const [replyError, setReplyError] = useState("")

  const [composerOpen, setComposerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/guestbook", { cache: "no-store" })
      const data = await res.json()
      setMessages(Array.isArray(data.messages) ? data.messages : [])
      setTotal(typeof data.total === "number" ? data.total : 0)
    } catch {
      /* 保留旧列表 */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.style.overflow = composerOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [composerOpen])

  async function submitMain(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!content.trim()) {
      setError(tr("写点什么再发吧～", "Write something first ~"))
      return
    }
    setPosting(true)
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, content, website: hp }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || tr("发送失败，稍后再试", "Failed, try again later"))
        return
      }
      setContent("")
      setComposerOpen(false)
      await load()
    } catch {
      setError(tr("网络开小差了，再试一次", "Network hiccup, try again"))
    } finally {
      setPosting(false)
    }
  }

  function openReply(id: string) {
    setReplyTo(id)
    setReplyNick("")
    setReplyContent("")
    setReplyError("")
  }

  async function submitReply(e: React.FormEvent, parentId: string) {
    e.preventDefault()
    setReplyError("")
    if (!replyContent.trim()) {
      setReplyError(tr("写点什么再发吧～", "Write something first ~"))
      return
    }
    setReplyPosting(true)
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: replyNick, content: replyContent, parentId, website: "" }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setReplyError(d.error || tr("发送失败，稍后再试", "Failed, try again later"))
        return
      }
      setReplyTo(null)
      setReplyContent("")
      await load()
    } catch {
      setReplyError(tr("网络开小差了，再试一次", "Network hiccup, try again"))
    } finally {
      setReplyPosting(false)
    }
  }

  const anonName = tr("匿名朋友", "A friend")
  const ownerBadge = tr("博主", "Author")

  /** 便签内的小头像：博主优先用站点头像，否则彩虹圈；访客为灰色字母圈。 */
  function NoteAvatar({ name, owner, small }: { name: string; owner: boolean; small?: boolean }) {
    const cls = small ? "h-6 w-6" : "h-8 w-8"
    if (owner && hostAvatar) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={hostAvatar} alt={name} className={`${cls} shrink-0 rounded-full object-cover`} />
    }
    return (
      <div
        className={`${cls} flex shrink-0 items-center justify-center rounded-full text-xs font-medium`}
        style={owner ? { backgroundImage: "var(--pride-gradient-h)", color: "#fff" } : { background: "rgba(0,0,0,0.06)", color: INK }}
      >
        {firstChar(name)}
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#f6f1e6] px-6 py-12 pb-28 md:px-12 lg:px-16 lg:pb-16 dark:bg-stone-900"
      style={{ backgroundImage: PAPER_NOISE }}
    >
      {/* 标题 */}
      <header className="mb-3">
        <h1 className="flex items-center gap-3 font-serif text-3xl font-bold text-foreground md:text-4xl">
          <i className="ri-cup-line text-2xl md:text-3xl" />
          {title}
        </h1>
      </header>

      {/* 欢迎语：一句话，重点留给下面的留言墙 */}
      {greeting && (
        <p className="mb-10 max-w-2xl whitespace-pre-wrap leading-relaxed text-foreground/70">{greeting}</p>
      )}

      {/* 计数 */}
      <div className="mb-5 flex items-center gap-2 text-sm text-foreground/60">
        <i className="ri-sticky-note-line" />
        {total > 0 ? tr(`墙上有 ${total} 条留言`, `${total} note${total > 1 ? "s" : ""} on the wall`) : tr("留言墙", "The wall")}
      </div>

      {/* 便签墙 */}
      {loading ? (
        <p className="text-foreground/50">{tr("加载中…", "Loading…")}</p>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/20 py-16 text-center text-foreground/50">
          {tr("墙上还空着，来贴第一张吧 ☕", "The wall is empty — stick the first note ☕")}
        </div>
      ) : (
        <div className="gap-5 [column-fill:_balance] columns-1 sm:columns-2 lg:columns-3">
          {messages.map((m, i) => (
            <motion.div
              key={m.id}
              className="mb-5 break-inside-avoid"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4, zIndex: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 22, delay: Math.min(i * 0.04, 0.4) }}
              style={{ position: "relative", zIndex: 1 }}
            >
              <div
                className={`rounded-2xl p-4 transition-colors ${
                  m.pinned
                    ? ""
                    : "border border-black/[0.06] hover:border-stone-300 dark:border-white/[0.08] dark:hover:border-stone-500"
                }`}
                style={
                  m.pinned
                    ? {
                        color: INK,
                        border: "2px solid transparent",
                        background:
                          "linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, var(--color-pride-1), var(--color-pride-4), var(--color-pride-7)) border-box",
                      }
                    : { backgroundColor: NOTE_BG, color: INK }
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <NoteAvatar name={m.nickname || anonName} owner={m.isOwner} />
                  <span className="font-medium">{m.nickname || anonName}</span>
                  {m.isOwner && (
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-medium">{ownerBadge}</span>
                  )}
                  {m.pinned && (
                    <span className="flex items-center gap-0.5 rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-medium">
                      <i className="ri-pushpin-2-fill" />
                      {tr("置顶", "Pinned")}
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</p>
                <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "rgba(63,58,51,0.55)" }}>
                  <span>{timeAgo(m.createdAt, isEn)}</span>
                  <button
                    type="button"
                    onClick={() => (replyTo === m.id ? setReplyTo(null) : openReply(m.id))}
                    className="hover:underline"
                  >
                    <i className="ri-chat-1-line mr-1" />
                    {tr("回复", "Reply")}
                  </button>
                </div>

                {/* 回复（贴在便签上的小纸条） */}
                {m.replies?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.replies.map((r) => (
                      <div key={r.id} className="rounded-lg bg-stone-100 p-2.5">
                        <div className="flex items-center gap-1.5">
                          <NoteAvatar name={r.nickname || anonName} owner={r.isOwner} small />
                          <span className="text-sm font-medium">{r.nickname || anonName}</span>
                          {r.isOwner && (
                            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-medium">{ownerBadge}</span>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 回复输入 */}
                {replyTo === m.id && (
                  <form onSubmit={(e) => submitReply(e, m.id)} className="mt-3 rounded-lg bg-stone-50 p-2.5">
                    <input
                      type="text"
                      value={replyNick}
                      onChange={(e) => setReplyNick(e.target.value)}
                      maxLength={60}
                      placeholder={tr("怎么称呼你？（可不填）", "Your name? (optional)")}
                      className="mb-2 w-full rounded border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-black/30"
                      style={{ color: INK }}
                    />
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder={tr("回复点什么…", "Write a reply...")}
                      className="w-full resize-y rounded border border-black/10 bg-white px-2 py-1 text-sm outline-none focus:border-black/30"
                      style={{ color: INK }}
                    />
                    {replyError && <p className="mt-1 text-xs text-red-600">{replyError}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <EmojiButton onPick={(e) => setReplyContent((c) => c + e)} label={tr("插入表情", "Insert emoji")} />
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setReplyTo(null)} className="rounded px-2.5 py-1 text-sm text-stone-500 hover:bg-black/5">
                          {tr("取消", "Cancel")}
                        </button>
                        <button
                          type="submit"
                          disabled={replyPosting}
                          className="rounded bg-stone-800 px-2.5 py-1 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
                        >
                          {replyPosting ? tr("发送中…", "Sending…") : tr("回复", "Reply")}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 浮标「写便签」+ 弹窗写便签（portal 到 body） */}
      {mounted &&
        createPortal(
          <>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-stone-800 px-5 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95 lg:bottom-8 dark:bg-white dark:text-stone-900"
            >
              <i className="ri-quill-pen-line text-base" />
              {tr("写便签", "Write a note")}
            </button>

            {composerOpen && (
              <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setComposerOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                  className="relative z-10 w-full max-w-md"
                >
                  <form onSubmit={submitMain} className="rounded-2xl p-5" style={{ backgroundColor: NOTE_BG, color: INK }}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-medium">{tr("写张便签贴上墙吧 ☕", "Write a note for the wall ☕")}</p>
                      <button
                        type="button"
                        onClick={() => setComposerOpen(false)}
                        aria-label={tr("关闭", "Close")}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-black/5 hover:text-stone-600"
                      >
                        <i className="ri-close-line text-lg" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={60}
                      placeholder={tr("怎么称呼你？（可不填）", "Your name? (optional)")}
                      className="mb-3 w-full rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-black/30"
                      style={{ color: INK }}
                    />
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      autoFocus
                      placeholder={tr("说点什么吧……", "Say something...")}
                      className="w-full resize-y rounded-lg border border-black/10 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-black/30"
                      style={{ color: INK }}
                    />
                    <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} className="hidden" />
                    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <EmojiButton onPick={(e) => setContent((c) => c + e)} label={tr("插入表情", "Insert emoji")} />
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: "rgba(63,58,51,0.5)" }}>{content.length}/1000</span>
                        <button
                          type="submit"
                          disabled={posting}
                          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
                        >
                          {posting ? tr("贴上墙…", "Sticking…") : tr("贴上墙", "Stick it")}
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </>,
          document.body,
        )}
    </div>
  )
}
