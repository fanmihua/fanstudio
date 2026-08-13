"use client"

/**
 * 「真实版」生活动态墙：照片 + 纯文字混排瀑布流。
 * 照片可点开看大图（lightbox 经 portal 挂到 body，避开层叠陷阱）。数据来自 pageCopy.lifeMoments。
 */
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import type { LifeMoment } from "@/lib/page-copy"

export function LifeWall({ moments, isEn }: { moments: LifeMoment[]; isEn: boolean }) {
  const tr = (zh: string, en: string) => (isEn ? en : zh)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const canUseDOM = typeof document !== "undefined"

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.style.overflow = lightbox ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [lightbox])

  if (!moments.length) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
        {tr("这里还空着，过阵子来看看吧 🐾", "Nothing here yet — check back soon 🐾")}
      </div>
    )
  }

  const sorted = [...moments].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  return (
    <>
      <div className="gap-4 [column-fill:_balance] columns-1 sm:columns-2 lg:columns-3">
        {sorted.map((m, i) => {
          const text = (isEn ? m.textEn : m.textZh) || m.textZh || m.textEn || ""
          return (
            <motion.div
              key={m.id}
              className="mb-4 break-inside-avoid"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 240, damping: 22, delay: Math.min(i * 0.05, 0.3) }}
            >
              <div
                className={`relative overflow-hidden rounded-xl border bg-card transition-colors duration-300 ${
                  m.pinned ? "border-primary" : "border-border hover:border-primary/40"
                }`}
              >
                {m.pinned && (
                  <span className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground backdrop-blur">
                    <i className="ri-pushpin-2-fill" />
                    {tr("置顶", "Pinned")}
                  </span>
                )}
                {m.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image}
                    alt={text || "moment"}
                    loading="lazy"
                    onClick={() => setLightbox(m.image!)}
                    className="w-full cursor-zoom-in object-cover"
                  />
                )}
                {text && (
                  <div className={m.image ? "px-4 py-3" : "p-5"}>
                    {!m.image && <i className="ri-double-quotes-l mb-1 block text-2xl text-foreground/15" />}
                    <p
                      className={
                        m.image
                          ? "text-sm leading-relaxed text-muted-foreground"
                          : "whitespace-pre-wrap leading-relaxed text-foreground/80"
                      }
                    >
                      {text}
                    </p>
                  </div>
                )}
                {m.musicId && (
                  <div className={`px-4 pb-4 ${!text && !m.image ? "pt-4" : ""}`}>
                    <a
                      href={`https://music.163.com/song?id=${m.musicId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      {m.musicCover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.musicCover}
                          alt=""
                          loading="lazy"
                          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <i className="ri-music-2-line text-lg" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium text-foreground">
                          {m.musicName || tr("网易云音乐", "NetEase Music")}
                        </span>
                        {m.musicArtist && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{m.musicArtist}</span>
                        )}
                      </span>
                      <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-[#c20c0c]">
                        <i className="ri-netease-cloud-music-fill text-base" />
                        {tr("去听", "Listen")}
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {canUseDOM &&
        lightbox &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
          </div>,
          document.body,
        )}
    </>
  )
}
