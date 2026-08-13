"use client"

/**
 * 文章分享:按钮(带「分享 X 次」计数) + 弹窗(生成海报 / 微信分享)。
 * - 海报:复用列表卡片样式(封面+标题+摘要+日期+标签)+ 右栏二维码,前端截图下载。
 * - 微信:在微信内通过 JS-SDK 自定义「分享给朋友 / 朋友圈」卡片,引导点右上角「···」。
 * - 计数:每次分享动作 +1(不去重),POST /api/shares。
 */
import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { domToPng } from "modern-screenshot"
import { withLocalePath } from "@/lib/i18n-path"
import type { Locale } from "@/lib/i18n"

interface PostShareProps {
  postId: string
  slug: string
  title: string
  excerpt?: string | null
  coverImage?: string | null
  categoryName?: string
  tags?: string[]
  date?: string | null
  initialShareCount?: number
  className?: string
  locale?: Locale
}

declare global {
  interface Window {
    wx?: {
      config: (c: Record<string, unknown>) => void
      ready: (cb: () => void) => void
      error: (cb: (e: unknown) => void) => void
      updateAppMessageShareData?: (c: Record<string, unknown>) => void
      updateTimelineShareData?: (c: Record<string, unknown>) => void
      onMenuShareAppMessage?: (c: Record<string, unknown>) => void
      onMenuShareTimeline?: (c: Record<string, unknown>) => void
    }
  }
}

const JWEIXIN_SRC = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js"

function loadWeixinSdk(): Promise<NonNullable<Window["wx"]>> {
  return new Promise((resolve, reject) => {
    if (window.wx) return resolve(window.wx)
    const s = document.createElement("script")
    s.src = JWEIXIN_SRC
    s.async = true
    s.onload = () => (window.wx ? resolve(window.wx) : reject(new Error("wx 未就绪")))
    s.onerror = () => reject(new Error("jweixin 加载失败"))
    document.head.appendChild(s)
  })
}

function stripHtml(html?: string | null): string {
  if (!html) return ""
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

function fmtDate(date?: string | null): string {
  if (!date) return ""
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()} / ${p(d.getMonth() + 1)} / ${p(d.getDate())}`
}

/**
 * 把图片(含 webp)先用 canvas 转成 PNG data URL。
 * 手机端截图库直接抓 <img src=webp> 常抓不到 → 封面空白;
 * 内联成 PNG data URL 后截图就稳了(封面同源 /uploads,canvas 不污染)。
 */
function imageToPngDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no ctx"))
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL("image/png"))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error("cover load failed"))
    img.src = src
  })
}

export function PostShare({
  postId,
  slug,
  title,
  excerpt,
  coverImage,
  categoryName,
  tags = [],
  date,
  initialShareCount = 0,
  className = "",
  locale = "zh",
}: PostShareProps) {
  const [count, setCount] = useState(Math.max(0, initialShareCount))
  const [menuOpen, setMenuOpen] = useState(false)
  const [posterOpen, setPosterOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [posterErr, setPosterErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 微信内统一启用自定义分享；二维码、分享卡片和 SEO 共用同一个规范 URL。
  const [wxShareReady, setWxShareReady] = useState(false)
  const [wxTip, setWxTip] = useState(false)
  const posterRef = useRef<HTMLDivElement>(null)

  const excerptText = stripHtml(excerpt)
  const dateText = fmtDate(date)

  const shareUrl = useCallback(() => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}${withLocalePath(`/blog/${slug}`, locale)}`
  }, [locale, slug])

  // 计数 +1(乐观更新)
  const bump = useCallback(async () => {
    setCount((c) => c + 1)
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "post", entityId: postId }),
      })
      if (res.ok) {
        const d = await res.json().catch(() => null)
        if (d && typeof d.count === "number") setCount(Math.max(0, d.count))
      } else {
        setCount((c) => Math.max(0, c - 1))
      }
    } catch {
      setCount((c) => Math.max(0, c - 1))
    }
  }, [postId])

  // 预生成二维码(指向文章,带来源标记),让海报节点随时可截
  useEffect(() => {
    QRCode.toDataURL(shareUrl(), { margin: 0, width: 280, color: { dark: "#1a1a1a", light: "#ffffff" } })
      .then(setQrUrl)
      .catch(() => {})
  }, [shareUrl])

  // 预把封面转成 PNG data URL(手机端截图才不会丢封面)
  useEffect(() => {
    if (!coverImage) return
    imageToPngDataUrl(coverImage)
      .then(setCoverUrl)
      .catch(() => setCoverUrl(null))
  }, [coverImage])

  // 微信环境:加载 JS-SDK 并配置「分享给朋友 / 朋友圈」卡片
  useEffect(() => {
    if (typeof navigator === "undefined") return
    const inWx = /micromessenger/i.test(navigator.userAgent)
    const hasLegacyPosterMarker =
      window.location.hash === "#from=poster" || /[?&]from=poster\b/.test(window.location.search)
    // 兼容旧二维码，进入页面后立即清理 query / fragment，回到唯一规范地址。
    if (hasLegacyPosterMarker) {
      window.history.replaceState(null, "", withLocalePath(`/blog/${slug}`, locale))
    }
    setWxShareReady(inWx)
    if (!inWx) return
    const pageUrl = window.location.href.split("#")[0]
    // 微信缩略图用 jpg 接口(webp 微信不一定认)
    const absCover = `${window.location.origin}/api/share-thumb?slug=${encodeURIComponent(slug)}`
    ;(async () => {
      try {
        const wx = await loadWeixinSdk()
        const r = await fetch(`/api/wechat/jssdk-signature?url=${encodeURIComponent(pageUrl)}`)
        if (!r.ok) return
        const sig = await r.json()
        if (sig.error) return
        wx.config({
          debug: false,
          appId: sig.appId,
          timestamp: sig.timestamp,
          nonceStr: sig.nonceStr,
          signature: sig.signature,
          jsApiList: [
            "updateAppMessageShareData",
            "updateTimelineShareData",
            "onMenuShareAppMessage",
            "onMenuShareTimeline",
          ],
        })
        wx.ready(() => {
          const link = shareUrl()
          // 新接口(当前微信)+ 老接口兜底(部分机型靠它渲染卡片)
          wx.updateAppMessageShareData?.({ title, desc: excerptText, link, imgUrl: absCover })
          wx.updateTimelineShareData?.({ title, link, imgUrl: absCover })
          wx.onMenuShareAppMessage?.({ title, desc: excerptText, link, imgUrl: absCover })
          wx.onMenuShareTimeline?.({ title, link, imgUrl: absCover })
        })
        wx.error(() => {})
      } catch {
        /* 微信签名失败不影响海报分享 */
      }
    })()
  }, [title, excerptText, slug, locale, shareUrl])

  // 生成海报
  const genPoster = useCallback(async () => {
    setMenuOpen(false)
    setPosterOpen(true)
    setPosterErr(null)
    if (posterUrl) return
    setBusy(true)
    try {
      // 确保封面已转成内联 PNG(手机端关键),否则截图会丢封面
      let cover = coverUrl
      if (coverImage && !cover) {
        try {
          cover = await imageToPngDataUrl(coverImage)
          setCoverUrl(cover)
        } catch {
          /* 转换失败则退回原 url */
        }
      }
      // 等二维码与封面渲染完毕
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const node = posterRef.current
      if (!node) throw new Error("节点缺失")
      const url = await domToPng(node, { scale: 2, backgroundColor: "#ffffff" })
      if (!url || url.length < 1000) throw new Error("截图为空")
      setPosterUrl(url)
    } catch (e) {
      setPosterErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [posterUrl, coverImage, coverUrl])

  const downloadPoster = useCallback(() => {
    if (!posterUrl) return
    const a = document.createElement("a")
    a.href = posterUrl
    a.download = `${title.slice(0, 40)}.png`
    a.click()
    bump()
  }, [posterUrl, title, bump])

  const onWechatShare = () => {
    setMenuOpen(false)
    setWxTip(true)
    bump()
  }

  const handleButton = () => {
    // 微信内展开「海报 / 微信」；其他浏览器直接生成海报。
    if (wxShareReady) setMenuOpen((o) => !o)
    else genPoster()
  }

  // 微信引导提示自动消失
  useEffect(() => {
    if (!wxTip) return
    const t = setTimeout(() => setWxTip(false), 4500)
    return () => clearTimeout(t)
  }, [wxTip])

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={handleButton}
        aria-label="分享"
        aria-haspopup={wxShareReady ? "menu" : undefined}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <i className="ri-share-forward-line" />
        <span className="tabular-nums">{count}</span>
        {wxShareReady && <i className="ri-arrow-down-s-line -mr-1 text-base opacity-60" />}
      </button>

      {/* 下拉菜单：微信内显示 */}
      {menuOpen && wxShareReady && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
          <div role="menu" className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl">
            <button
              type="button"
              role="menuitem"
              onClick={genPoster}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              <i className="ri-image-line text-lg text-muted-foreground" /> 生成海报
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onWechatShare}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              <i className="ri-wechat-line text-lg text-[#07c160]" /> 微信分享
            </button>
          </div>
        </>
      )}

      {/* 微信分享引导(顶部 toast) */}
      {wxTip && (
        <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4" onClick={() => setWxTip(false)}>
          <div className="max-w-xs rounded-xl bg-foreground/90 px-4 py-2.5 text-center text-xs leading-relaxed text-background shadow-lg">
            点右上角「···」→「发送给朋友」或「分享到朋友圈」
            <br />
            卡片标题与封面已自动配置
          </div>
        </div>
      )}

      {/* 海报预览浮层(结果展示) */}
      {posterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setPosterOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">分享海报</h3>
              <button type="button" onClick={() => setPosterOpen(false)} aria-label="关闭" className="text-muted-foreground hover:text-foreground">
                <i className="ri-close-line text-xl" />
              </button>
            </div>
            {busy && !posterUrl && (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                <i className="ri-loader-4-line mr-2 animate-spin" /> 正在生成海报…
              </div>
            )}
            {!busy && !posterUrl && posterErr && (
              <div className="flex h-64 flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-sm text-muted-foreground">海报生成失败</p>
                <p className="break-all text-xs text-rose-500">{posterErr}</p>
                <button
                  type="button"
                  onClick={genPoster}
                  className="rounded-lg border border-border px-4 py-1.5 text-sm text-foreground hover:bg-accent"
                >
                  重试
                </button>
              </div>
            )}
            {posterUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={posterUrl} alt="分享海报" className="w-full rounded-xl border border-border" />
                <p className="mt-2 text-center text-xs text-muted-foreground">手机端可长按图片保存</p>
                <button
                  type="button"
                  onClick={downloadPoster}
                  className="mt-3 w-full rounded-xl bg-foreground py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
                >
                  下载海报
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 离屏海报节点(始终挂载,封面/二维码预加载,截图用;left 离屏即可,勿用 opacity:0 以免截图变透明) */}
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}>
        <div
          ref={posterRef}
          style={{
            width: 600,
            background: "#fff",
            borderRadius: 24,
            overflow: "hidden",
            fontFamily: '-apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif',
          }}
        >
          {(coverUrl || coverImage) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl || coverImage || ""} alt="" style={{ width: "100%", display: "block" }} />
          )}
          <div style={{ display: "flex", alignItems: "stretch", padding: "26px 30px", gap: 22 }}>
            <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
              <h2
                style={{
                  fontSize: 19,
                  fontWeight: 700,
                  color: "#1a1a1a",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  margin: 0,
                }}
              >
                {title}
              </h2>
              {excerptText && (
                <p
                  style={{
                    marginTop: 11,
                    fontSize: 15.5,
                    color: "#6b6b6b",
                    lineHeight: 1.62,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {excerptText}
                </p>
              )}
              <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 9 }}>
                {dateText && (
                  <span style={{ fontSize: 13, color: "#9b9b9b", letterSpacing: 0.4, fontFamily: "ui-monospace, Menlo, Consolas, monospace", marginRight: 4 }}>
                    {dateText}
                  </span>
                )}
                {categoryName && (
                  <span style={{ fontSize: 12.5, padding: "5px 11px", borderRadius: 8, lineHeight: 1, background: "rgba(10,10,10,.05)", color: "rgba(10,10,10,.62)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {categoryName}
                  </span>
                )}
                {tags.slice(0, 3).map((tg) => (
                  <span key={tg} style={{ fontSize: 12.5, padding: "5px 11px", borderRadius: 8, lineHeight: 1, background: "#f3f3f4", color: "#9a9a9a", whiteSpace: "nowrap" }}>
                    {tg}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ flex: "0 0 auto", alignSelf: "stretch", paddingLeft: 22, borderLeft: "1px solid #ececee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {qrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="" style={{ width: 84, height: 84, display: "block", borderRadius: 6 }} />
              )}
              <div style={{ marginTop: 9, fontSize: 12, color: "#9b9b9b", letterSpacing: 1.5, textAlign: "center" }}>扫码阅读</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
