"use client"
/** 作品详情页右侧购买侧栏：价格、购买/升级、邮箱、订单校验与支付跳转。 */
import { CardDescriptionHtml } from "@/components/frontend/CardDescriptionHtml"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { createPortal } from "react-dom"
import { GlowBorder } from "@/components/react-bits"
import { LikeButton } from "@/components/frontend/LikeButton"
import { detectLocaleFromPath } from "@/lib/i18n-path"

/** 检测当前是否在微信内置浏览器 */
function getIsWechat(): boolean {
  if (typeof navigator === "undefined") return false
  return /MicroMessenger/i.test(navigator.userAgent)
}

/** 检测当前是否在移动设备 */
function getIsMobile(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

interface PurchaseSidebarProps {
  workId: string
  title: string
  description: string
  categoryName: string
  tags?: { id: string; name: string }[]
  price: number | null
  isFree: boolean
  hasDeliveryUrl: boolean
  updatedAt: string | null
  currentVersion: string | null
  demoUrl?: string | null
  demoQrCode?: string | null
  /** 开发类作品不展示价格和购买区域 */
  isDev?: boolean
  /** 下载量（已支付订单数） */
  downloadCount?: number
  /** 点赞数 */
  likeCount?: number
}

interface CheckResult {
  purchased: boolean
  hasLatest?: boolean
  figmaUrl?: string | null
  deliveryUrl?: string | null
  paidVersion?: string | null
  paidAmount?: number
  paidVersions?: { version: string; figmaUrl: string | null; deliveryUrl: string | null }[]
  upgradePrice?: number
  currentPrice?: number
  currentVersion?: string | null
  latestVersionId?: string
  isFree?: boolean
}

export function PurchaseSidebar({
  workId,
  title,
  description,
  categoryName,
  tags,
  price,
  isFree,
  hasDeliveryUrl,
  updatedAt,
  currentVersion,
  demoUrl,
  demoQrCode,
  isDev,
  downloadCount,
  likeCount,
}: PurchaseSidebarProps) {
  const pathname = usePathname()
  const locale = detectLocaleFromPath(pathname || "/")
  const isEn = locale === "en"
  const txt = (zh: string, en: string) => (isEn ? en : zh)

  // ===== 共享状态 =====
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [figmaUrl, setFigmaUrl] = useState<string | null>(null)
  const [deliveryUrl, setDeliveryUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // 方案B 后不再在页面展示已购版本链接，仅保留空数组以维持查询入口的显示判断
  const [paidVersions] = useState<{ version: string; figmaUrl: string | null; deliveryUrl: string | null }[]>([])
  // 方案B：已购的交付链接改为发到邮箱，这里只记录提示文案，不在页面展示链接
  const [deliveredNote, setDeliveredNote] = useState("")

  // ===== 查询弹窗 =====
  const [queryOpen, setQueryOpen] = useState(false)
  const [queryError, setQueryError] = useState("")
  const [queryNotice, setQueryNotice] = useState("")

  // ===== 环境检测 =====
  const [isWechat, setIsWechat] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsWechat(getIsWechat())
    setIsMobile(getIsMobile())
  }, [])

  // ===== 购买弹窗 =====
  const [buyOpen, setBuyOpen] = useState(false)
  const [buyError, setBuyError] = useState("")
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [orderNo, setOrderNo] = useState<string | null>(null)
  // 轮询支付状态用不可枚举的订单 id（cuid）作凭证，不用可枚举的 orderNo
  const [orderId, setOrderId] = useState<string | null>(null)
  const [wechatQrDataUrl, setWechatQrDataUrl] = useState<string | null>(null)
  const [wechatCreateError, setWechatCreateError] = useState<string | null>(null)
  const [wechatCreateLoading, setWechatCreateLoading] = useState(false)

  // ---------- 查询逻辑 ----------
  function openQueryDialog() {
    setQueryOpen(true)
    setQueryError("")
    setQueryNotice("")
  }

  async function handleQuery() {
    if (!email.trim() || !email.includes("@")) {
      setQueryError(txt("请输入有效的邮箱地址", "Please enter a valid email address"))
      return
    }
    setLoading(true)
    setQueryError("")
    try {
      const res = await fetch(
        `/api/orders/check?email=${encodeURIComponent(email.trim())}&workId=${workId}`,
      )
      const data: CheckResult = await res.json()
      if (!res.ok) {
        setQueryError((data as { error?: string }).error || txt("查询失败", "Query failed"))
        return
      }

      if (!data.purchased) {
        setQueryError(txt("该邮箱暂无赞助记录", "No sponsorship record found for this email"))
        return
      }

      // 方案B：命中已购 → 交付链接已由后端发到该邮箱，页面不再直接展示链接
      setQueryNotice(
        txt(
          `交付链接已发送到 ${email.trim()}，请查收邮箱（含垃圾箱）`,
          `Delivery links have been sent to ${email.trim()}. Please check your inbox (and spam folder).`,
        ),
      )
    } catch {
      setQueryError(txt("网络错误，请重试", "Network error, please try again"))
    } finally {
      setLoading(false)
    }
  }

  // ---------- 购买逻辑 ----------
  function openBuyDialog() {
    setBuyOpen(true)
    setBuyError("")
    setCheckResult(null)
    setOrderNo(null)
    setOrderId(null)
    setDeliveredNote("")
    setWechatQrDataUrl(null)
    setWechatCreateError(null)
  }

  // ========== Native 下单获取二维码（微信内跳过，直接引导去电脑端）==========
  useEffect(() => {
    if (isWechat) return
    if (!orderNo || wechatQrDataUrl || wechatCreateError !== null) return
    let cancelled = false
    setWechatCreateLoading(true)
    setWechatCreateError(null)
    fetch("/api/payment/wechat/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNo }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.qr_data_url) {
          setWechatQrDataUrl(data.qr_data_url)
        } else {
          setWechatCreateError(data.error || txt("获取支付二维码失败", "Failed to get payment QR code"))
        }
      })
      .catch(() => {
        if (!cancelled) setWechatCreateError(txt("网络错误，请重试", "Network error, please try again"))
      })
      .finally(() => {
        if (!cancelled) setWechatCreateLoading(false)
      })
    return () => { cancelled = true }
  }, [orderNo, wechatQrDataUrl, wechatCreateError])

  // ========== 轮询订单支付状态（每 3 秒） ==========
  const hasAnyDelivery = !!(figmaUrl || deliveryUrl)
  const shouldPoll = !!(orderId && !hasAnyDelivery && wechatQrDataUrl)
  useEffect(() => {
    if (!shouldPoll || !orderId) return
    let cancelled = false
    const poll = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/orders/check-status?id=${encodeURIComponent(orderId)}`,
        )
        if (!res.ok || cancelled) return
        const data: { status: string; figmaUrl?: string | null; deliveryUrl?: string | null } =
          await res.json()
        if (cancelled) return
        if (data.status === "PAID") {
          if (data.figmaUrl) setFigmaUrl(data.figmaUrl)
          if (data.deliveryUrl) setDeliveryUrl(data.deliveryUrl)
          if (!data.figmaUrl && !data.deliveryUrl) {
            setFigmaUrl("")
            setDeliveryUrl("")
          }
        }
      } catch {
        // 静默忽略网络错误，下次继续轮询
      }
    }, 3000)
    return () => { cancelled = true; clearInterval(poll) }
  }, [shouldPoll, orderId])

  async function handleBuy() {
    if (!email.trim() || !email.includes("@")) {
      setBuyError(txt("请输入有效的邮箱地址", "Please enter a valid email address"))
      return
    }
    setLoading(true)
    setBuyError("")
    try {
      // 先查询购买状态
      const checkRes = await fetch(
        `/api/orders/check?email=${encodeURIComponent(email.trim())}&workId=${workId}`,
      )
      const checkData: CheckResult = await checkRes.json()
      if (!checkRes.ok) {
        setBuyError((checkData as { error?: string }).error || txt("查询失败", "Query failed"))
        return
      }

      // 方案B：已购最新版 -> 交付链接已发到邮箱，不再当场展示链接
      if (checkData.purchased && checkData.hasLatest) {
        setDeliveredNote(
          txt(
            `已发送到 ${email.trim()}，请查收邮箱（含垃圾箱）`,
            `Sent to ${email.trim()}. Please check your inbox (and spam folder).`,
          ),
        )
        return
      }

      // 已购旧版本 -> 显示升级信息（升级项不含链接；旧版链接已由后端发到邮箱）
      if (checkData.purchased && !checkData.hasLatest) {
        setCheckResult(checkData)
        return
      }

      // 未购买 -> 直接创建订单
      const body: Record<string, unknown> = {
        workId,
        buyerEmail: email.trim(),
      }
      if (checkData.latestVersionId) {
        body.versionId = checkData.latestVersionId
      }
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) {
        setBuyError(orderData.error || txt("创建订单失败", "Failed to create order"))
        return
      }
      if (orderData.figmaUrl) setFigmaUrl(orderData.figmaUrl)
      if (orderData.deliveryUrl) setDeliveryUrl(orderData.deliveryUrl)
      setOrderNo(orderData.orderNo)
      setOrderId(orderData.id)
      setWechatQrDataUrl(null)
      setWechatCreateError(null)
    } catch {
      setBuyError(txt("网络错误，请重试", "Network error, please try again"))
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade() {
    if (!checkResult) return
    setLoading(true)
    setBuyError("")
    try {
      const body: Record<string, unknown> = {
        workId,
        buyerEmail: email.trim(),
      }
      if (checkResult.latestVersionId) body.versionId = checkResult.latestVersionId
      body.upgradeFromId = checkResult.paidVersion || "previous"
      body.upgradeAmount = checkResult.upgradePrice ?? 0

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setBuyError(data.error || txt("创建订单失败", "Failed to create order"))
        return
      }
      if (data.figmaUrl) setFigmaUrl(data.figmaUrl)
      if (data.deliveryUrl) setDeliveryUrl(data.deliveryUrl)
      setOrderNo(data.orderNo)
      setOrderId(data.id)
      setWechatQrDataUrl(null)
      setWechatCreateError(null)
    } catch {
      setBuyError(txt("网络错误，请重试", "Network error, please try again"))
    } finally {
      setLoading(false)
    }
  }

  // ⚠️ 测试用：模拟支付成功
  async function handleSimulatePay() {
    if (!orderNo) return
    setLoading(true)
    setBuyError("")
    try {
      const res = await fetch("/api/orders/simulate-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBuyError(data.error || txt("模拟支付失败", "Simulation failed"))
        return
      }
      if (data.figmaUrl) setFigmaUrl(data.figmaUrl)
      if (data.deliveryUrl) setDeliveryUrl(data.deliveryUrl)
    } catch {
      setBuyError(txt("网络错误，请重试", "Network error, please try again"))
    } finally {
      setLoading(false)
    }
  }

  const hasAnyUrl = !!(figmaUrl || deliveryUrl)

  function handleCopyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const displayPrice = isFree ? 0 : (price ?? 0)

  return (
    <>
      <GlowBorder className="lg:sticky lg:top-12 rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
        <div className="p-6 lg:p-8">
          {(categoryName || (tags && tags.length > 0)) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {categoryName && (
                <span className="tag flex items-center gap-1" title={categoryName}>
                  <i className="ri-folder-line shrink-0" /> {categoryName}
                </span>
              )}
              {(tags ?? []).map((tag) => (
                <span key={tag.id} className="tag" title={tag.name}>{tag.name}</span>
              ))}
            </div>
          )}

          <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-3">
            {title}
          </h1>

          {description && (
            <CardDescriptionHtml
              html={description}
              lines={false}
              className="text-muted-foreground text-sm leading-relaxed mb-6"
            />
          )}

          {/* 在线体验入口 */}
          {(demoUrl || demoQrCode) && (
            <div className="mb-6 space-y-3">
              {demoQrCode && (
                <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-accent/30">
                  <img
                    src={demoQrCode}
                    alt={txt("扫码体验", "Scan to preview")}
                    className="w-36 h-36 rounded-lg object-contain"
                  />
                  <span className="text-xs text-muted-foreground">{txt("扫码体验", "Scan to preview")}</span>
                </div>
              )}
              {demoUrl && (
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl border border-border bg-accent/50 hover:bg-accent text-foreground font-medium text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <i className="ri-external-link-line" />
                  {txt("在线体验", "Live Demo")}
                </a>
              )}
            </div>
          )}

          {!isDev && (<>
          <div className="border-t border-border mb-6" />

          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-5xl font-bold tracking-tight text-foreground">
                <span className="text-2xl font-normal text-muted-foreground mr-0.5">¥</span>
                {displayPrice}
              </span>
              {!isFree && (
                <span className="text-sm text-muted-foreground">{txt("一次赞助，持续使用", "One-time support, ongoing access")}</span>
              )}
            </div>

            {/* 主按钮 */}
            {hasAnyUrl ? (
              <div className="space-y-2">
                {figmaUrl && (
                  <button
                    onClick={() => window.open(figmaUrl, "_blank")}
                    className="w-full py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="ri-figma-line" />
                    {txt("在 Figma 中打开", "Open in Figma")}
                  </button>
                )}
                {deliveryUrl && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-green-500/30 bg-green-500/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">{txt("自定义链接", "Custom link")}</p>
                      <p className="text-sm text-foreground truncate" title={deliveryUrl}>{deliveryUrl}</p>
                    </div>
                    <button
                      onClick={() => handleCopyLink(deliveryUrl)}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-all flex items-center gap-1"
                    >
                      <i className={copied ? "ri-check-line" : "ri-file-copy-line"} />
                      {copied ? txt("已复制", "Copied") : txt("复制", "Copy")}
                    </button>
                  </div>
                )}
              </div>
            ) : hasDeliveryUrl ? (
              isMobile && !isFree ? (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const url = window.location.href.split("?")[0]
                      navigator.clipboard.writeText(url).then(() => {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      })
                    }}
                    className="w-full py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <i className={copied ? "ri-check-line" : "ri-link"} />
                    {copied ? txt("已复制，去电脑端打开吧", "Copied, open it on desktop") : txt("复制链接，电脑端赞助", "Copy link for desktop payment")}
                  </button>
                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    {txt("移动端暂不支持扫码支付，请在电脑浏览器中打开链接赞助", "Mobile does not support QR payment yet. Please open this page in a desktop browser.")}
                  </p>
                </div>
              ) : (
                <button
                  onClick={openBuyDialog}
                  className="w-full py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <i className={isFree ? "ri-gift-line" : "ri-heart-line"} />
                  {isFree ? txt("开源获取", "Get open-source version") : txt("立即赞助", "Support now")}
                </button>
              )
            ) : (
              <div className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-medium flex items-center justify-center gap-2 text-sm">
                <i className="ri-eye-line" />
                {txt("仅供预览", "Preview only")}
              </div>
            )}

            {/* 已购版本列表 */}
            {paidVersions.length > 0 && !hasAnyUrl && (
              <div className="space-y-2">
                {paidVersions.map((pv, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-xs font-medium text-green-600 flex items-center gap-1">
                      <i className="ri-checkbox-circle-fill" />
                      V{pv.version}{txt("（已购）", " (Purchased)")}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {pv.figmaUrl && (
                        <button
                          onClick={() => window.open(pv.figmaUrl!, "_blank")}
                          className="w-full py-2 rounded-lg border border-border bg-accent/50 text-foreground text-sm font-medium hover:bg-accent transition-all flex items-center justify-center gap-2"
                        >
                          <i className="ri-figma-line" />
                          {txt("在 Figma 中打开", "Open in Figma")}
                        </button>
                      )}
                      {pv.deliveryUrl && (
                        <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-accent/30">
                          <p className="flex-1 min-w-0 text-xs text-foreground/70 truncate" title={pv.deliveryUrl}>{pv.deliveryUrl}</p>
                          <button
                            onClick={() => handleCopyLink(pv.deliveryUrl!)}
                            className="shrink-0 px-2 py-1 rounded bg-foreground/10 text-foreground text-xs hover:bg-foreground/20 transition-all"
                          >
                            <i className="ri-file-copy-line" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 查询入口 */}
            {hasDeliveryUrl && !hasAnyUrl && paidVersions.length === 0 && !isFree && (
              <button
                onClick={openQueryDialog}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
              >
                <i className="ri-search-line text-xs" />
                {txt("已赞助？查询赞助记录", "Already supported? Check record")}
              </button>
            )}
          </div>
          </>)}

          <div className="mt-6 pt-6 border-t border-border space-y-3 text-sm">
            {currentVersion && (
              <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                  <i className="ri-price-tag-3-line" /> {txt("版本", "Version")}
              </span>
                <span className="text-foreground/70">V{currentVersion}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <i className="ri-calendar-line" /> {txt("更新时间", "Updated")}
              </span>
              <span className="text-foreground/70">
                {updatedAt ? new Date(updatedAt).toLocaleDateString(isEn ? "en-US" : "zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) : "-"}
              </span>
            </div>
            {(downloadCount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <i className="ri-download-2-line" /> {txt("下载量", "Downloads")}
                </span>
                <span className="text-foreground/70 tabular-nums">{downloadCount}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <i className="ri-heart-3-line" /> {txt("点赞", "Like")}
              </span>
              <LikeButton entityType="work" entityId={workId} initialCount={likeCount} size="md" />
            </div>
          </div>
        </div>
      </GlowBorder>

      {/* ========== 查询弹窗 ========== */}
      {queryOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!loading) setQueryOpen(false) }}
          >
            <div
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">{txt("查询赞助记录", "Check support record")}</h2>
                  <button
                    onClick={() => setQueryOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    <i className="ri-close-line text-xl" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {txt("赞助邮箱", "Support email")}
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleQuery() }}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground/70 leading-relaxed">
                    {txt("请输入赞助时使用的邮箱，用于查询已获取的资源记录。", "Enter the email used for payment to retrieve your resources.")}
                  </p>
                </div>

                {queryError && (
                  <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
                    {queryError}
                  </div>
                )}

                {queryNotice && (
                  <div className="rounded-lg bg-green-500/10 text-green-600 px-3 py-2 text-sm flex items-start gap-2">
                    <i className="ri-mail-check-line mt-0.5 shrink-0" />
                    <span>{queryNotice}</span>
                  </div>
                )}

                <button
                  onClick={handleQuery}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      {txt("查询中…", "Checking…")}
                    </>
                  ) : (
                    <>
                      <i className="ri-search-line" />
                      {txt("查询", "Check")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ========== 购买弹窗 ========== */}
      {buyOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!loading) setBuyOpen(false) }}
          >
            <div
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    {hasAnyUrl ? txt("获取资源", "Get resources") : orderNo ? txt("等待支付", "Waiting for payment") : checkResult?.purchased ? txt("版本升级", "Upgrade version") : isFree ? txt("开源获取", "Get open-source version") : txt("赞助作品", "Support this work")}
                  </h2>
                  <button
                    onClick={() => { if (!loading) setBuyOpen(false) }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    <i className="ri-close-line text-xl" />
                  </button>
                </div>

                {/* === 已购：交付链接已发到邮箱 === */}
                {deliveredNote ? (
                  <div className="flex flex-col items-center text-center py-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                      <i className="ri-mail-send-line text-green-500 text-3xl" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {txt("交付链接已发送到邮箱", "Links sent to your email")}
                    </h3>
                    <p className="text-sm text-muted-foreground">{deliveredNote}</p>
                    <p className="text-xs text-muted-foreground">
                      {txt("没收到？请检查垃圾箱，或稍后用「查询赞助记录」重新发送。", "Not received? Check spam, or resend later via \"Check support record\".")}
                    </p>
                  </div>
                ) : hasAnyUrl ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center py-4">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                        <i className={isFree ? "ri-gift-fill text-green-500 text-3xl" : "ri-heart-3-fill text-green-500 text-3xl"} />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        {isFree ? txt("获取成功", "Success") : txt("感谢您的支持", "Thanks for your support")}
                      </h3>
                      {!isFree && orderNo && (
                        <p className="text-sm text-muted-foreground">
                          {txt("赞助编号", "Order No.")}: {orderNo}
                        </p>
                      )}
                    </div>

                    {/* Figma 跳转按钮 */}
                    {figmaUrl && (
                      <button
                        onClick={() => window.open(figmaUrl, "_blank")}
                        className="w-full py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="ri-figma-line" />
                        {txt("在 Figma 中打开", "Open in Figma")}
                      </button>
                    )}

                    {/* 自定义链接复制 */}
                    {deliveryUrl && (
                      <div className="rounded-xl border border-border bg-accent/30 p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">{txt("自定义链接", "Custom link")}</p>
                        <div className="flex items-center gap-2">
                          <p className="flex-1 min-w-0 text-sm text-foreground break-all line-clamp-2" title={deliveryUrl}>{deliveryUrl}</p>
                          <button
                            onClick={() => handleCopyLink(deliveryUrl)}
                            className="shrink-0 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-all flex items-center gap-1.5"
                          >
                            <i className={copied ? "ri-check-line" : "ri-file-copy-line"} />
                            {copied ? txt("已复制", "Copied") : txt("复制链接", "Copy link")}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isFree && (
                      <>
                        <p className="text-xs text-muted-foreground text-center">
                          {txt("请妥善保管您的邮箱，后续可通过邮箱查询赞助记录。", "Keep your email safe. You can use it to retrieve your resources later.")}
                        </p>
                        <p className="text-xs text-muted-foreground text-center">
                          {txt("如需返还或有其他疑问，请联系站点管理员。", "For refunds or other questions, please contact the site owner.")}
                        </p>
                      </>
                    )}
                  </div>
                ) : orderNo ? (
                  /* === 待支付 === */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <i className="ri-time-line text-amber-500 text-xl" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{txt("等待支付", "Waiting for payment")}</p>
                        <p className="text-xs text-muted-foreground">{txt("赞助编号", "Order No.")}: {orderNo}</p>
                      </div>
                    </div>

                    {isWechat ? (
                      /* --- 微信内：引导去电脑端支付 --- */
                      <div className="flex flex-col items-center gap-4 py-4">
                        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <i className="ri-computer-line text-amber-500 text-3xl" />
                        </div>
                        <div className="text-center space-y-1.5">
                          <p className="text-sm font-medium text-foreground">{txt("请在电脑端完成支付", "Please complete payment on desktop")}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {txt("微信内暂不支持扫码支付，请复制下方链接", "In WeChat browser, QR payment is not supported yet. Copy the link below")}<br />
                            {txt("在电脑浏览器中打开，使用微信扫码付款", "Open it in a desktop browser and pay via WeChat QR")}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const url = window.location.href.split("?")[0]
                            navigator.clipboard.writeText(url).then(() => {
                              setCopied(true)
                              setTimeout(() => setCopied(false), 2000)
                            })
                          }}
                          className="w-full py-2.5 rounded-xl border border-border bg-accent/50 hover:bg-accent
                            text-foreground font-medium text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          <i className={copied ? "ri-check-line text-green-500" : "ri-link"} />
                          {copied ? txt("已复制，去电脑端打开吧", "Copied, open it on desktop") : txt("复制页面链接", "Copy page link")}
                        </button>
                        <p className="text-xs text-muted-foreground text-center">
                          {txt("支付成功后将发邮件到您的邮箱", "After payment, we will email your resources")}<br />{txt("也可通过「查询赞助记录」获取资源", "or retrieve via \"Check support record\"")}
                        </p>
                      </div>
                    ) : wechatCreateLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{txt("正在生成支付二维码…", "Generating payment QR code…")}</p>
                      </div>
                    ) : wechatQrDataUrl ? (
                      <div className="flex flex-col items-center gap-3 py-2">
                        <img
                          src={wechatQrDataUrl}
                          alt={txt("微信扫码支付", "WeChat QR Payment")}
                          className="w-[260px] h-[260px] rounded-xl border border-border bg-white p-2"
                        />
                        <p className="text-sm font-medium text-foreground">{txt("请使用微信扫码支付", "Please scan with WeChat to pay")}</p>
                        <p className="text-xs text-muted-foreground">
                          {txt("支付成功后将发邮件到您的邮箱，也可通过「查询赞助记录」获取资源", "After payment, we will email your resources. You can also retrieve via \"Check support record\".")}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground text-center">
                          {wechatCreateError ?? txt("微信支付功能即将上线，敬请期待", "WeChat Pay is coming soon.")}
                        </p>
                        {/* 测试按钮：未配置微信或开发环境可用 */}
                        <div className="border-t border-dashed border-border pt-4">
                          <p className="text-xs text-muted-foreground/60 text-center mb-2">{txt("— 测试模式 —", "— Test Mode —")}</p>
                          <button
                            onClick={handleSimulatePay}
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {loading ? (
                              <><i className="ri-loader-4-line animate-spin" /> {txt("处理中…", "Processing…")}</>
                            ) : (
                              <><i className="ri-test-tube-line" /> {txt("模拟支付成功", "Simulate payment success")}</>
                            )}
                          </button>
                        </div>
                      </>
                    )}

                    {buyError && (
                      <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
                        {buyError}
                      </div>
                    )}
                  </div>
                ) : checkResult?.purchased && !checkResult.hasLatest ? (
                  /* === 已购旧版本：升级 === */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <i className="ri-arrow-up-circle-fill text-amber-500 text-xl" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{txt("发现新版本可升级", "A newer version is available")}</p>
                        <p className="text-xs text-muted-foreground">
                          {checkResult.paidVersion && `${txt("已购", "Purchased")}: V${checkResult.paidVersion} · `}
                          {txt("已支付", "Paid")}: ¥{checkResult.paidAmount ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-accent/50 border border-border/50 space-y-3">
                      <span className="text-sm font-medium text-foreground">
                        {txt("升级到", "Upgrade to")} V{checkResult.currentVersion}
                      </span>
                      <div className="flex items-baseline gap-2">
                        {(checkResult.upgradePrice ?? 0) > 0 ? (
                          <>
                            <span className="text-2xl font-bold text-foreground">¥{checkResult.upgradePrice}</span>
                            <span className="text-sm text-muted-foreground line-through">¥{checkResult.currentPrice}</span>
                            <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">{txt("补差价", "Pay difference")}</span>
                          </>
                        ) : (
                          <span className="text-2xl font-bold text-green-600">{txt("开源升级", "Free upgrade")}</span>
                        )}
                      </div>
                    </div>
                    {buyError && (
                      <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">{buyError}</div>
                    )}
                    <button
                      onClick={handleUpgrade}
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <><i className="ri-loader-4-line animate-spin" /> {txt("处理中…", "Processing…")}</>
                      ) : (checkResult.upgradePrice ?? 0) > 0 ? (
                        <><i className="ri-arrow-up-circle-line" /> {txt("升级", "Upgrade")} ¥{checkResult.upgradePrice}</>
                      ) : (
                        <><i className="ri-gift-line" /> {txt("开源升级", "Free upgrade")}</>
                      )}
                    </button>
                  </div>
                ) : (
                  /* === 邮箱输入 + 购买 === */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50 border border-border/50">
                      <i className="ri-palette-line text-xl text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{title}</p>
                        <p className="text-xs text-muted-foreground">
                          ¥{displayPrice}
                          {currentVersion && ` · V${currentVersion}`}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        {txt("邮箱地址", "Email")} <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleBuy() }}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                        disabled={loading}
                      />
                      {isFree ? (
                        <p className="text-xs text-muted-foreground/70 leading-relaxed">
                          {txt("邮件将作为您获取资源的凭证，请填写常用邮箱。", "Email will be used to retrieve your resources. Please use a frequently used address.")}
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground/70 leading-relaxed">
                            {txt("本站为个人网站，不提供账户系统与在线查询。邮件将作为您获取资源的唯一凭证，请务必填写常用邮箱。", "This is a personal site without an account system. Email is your only credential for retrieving resources.")}
                          </p>
                          <p className="text-xs text-muted-foreground/70 leading-relaxed">
                            {txt("赞助后不支持自助返还，如需返还或有其他疑问，请联系站点管理员。", "Self-service refunds are not supported. For refunds or questions, please contact the site owner.")}
                          </p>
                        </>
                      )}
                    </div>
                    {buyError && (
                      <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">{buyError}</div>
                    )}
                    <button
                      onClick={handleBuy}
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-foreground text-background font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <><i className="ri-loader-4-line animate-spin" /> {txt("处理中…", "Processing…")}</>
                      ) : isFree ? (
                        <><i className="ri-gift-line" /> {txt("开源获取", "Get open-source version")}</>
                      ) : (
                        <><i className="ri-heart-line" /> {txt("确认赞助", "Confirm support")} ¥{displayPrice}</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
