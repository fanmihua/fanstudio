"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { MemberAuthShell, MemberPageBg } from "@/components/member/MemberAuthShell"
import { SiteStatBadge } from "@/components/stats/SiteStatBadge"
import { IcpLink } from "@/components/frontend/IcpLink"

interface Plan {
  key: string
  name: string
  price: number
  originalPrice: number | null
  durationDays: number | null
  badge: string | null
  recommended: boolean
  upgradeCredit?: number
  upgradeCreditRaw?: number
  upgradeUnusedDays?: number
}
interface Me {
  member: { email: string } | null
  access: boolean
  entitlements: {
    productKey: string
    productName: string
    isLifetime: boolean
    expiresAt: string | null
    source: "PURCHASE" | "COMP"
    active: boolean
    revoked: boolean
  }[]
}

function durationLabel(d: number | null): string {
  if (d == null) return "长期权益，一次开通"
  if (d % 365 === 0) return `有效 ${d / 365} 年`
  if (d % 30 === 0) return `有效 ${d / 30} 个月`
  return `有效 ${d} 天`
}

function fmtDate(value: string | null): string {
  if (!value) return ""
  return new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" })
}

/** 手机端没法扫自己屏幕的二维码 → 引导复制链接到电脑开通（同作品购买的逻辑）。 */
function getIsMobile(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const isDev = process.env.NODE_ENV !== "production"
const PENDING_PLAN_KEY_PREFIX = "member_pending_plan:"

const BENEFITS = [
  { icon: "ri-key-line", text: "权益绑定当前登录邮箱" },
  { icon: "ri-time-line", text: "有效期与套餐规则清晰可查" },
]

function JoinInner() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get("next") || "/member"
  const product = search.get("product")?.trim() || ""
  const pendingPlanStorageKey = `${PENDING_PLAN_KEY_PREFIX}${product}`

  const [me, setMe] = useState<Me | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [productName, setProductName] = useState("")
  const [buyingKey, setBuyingKey] = useState("")
  const [selectedPlanKey, setSelectedPlanKey] = useState("")
  const [step, setStep] = useState<"plans" | "pay" | "mobile">("plans")
  const [order, setOrder] = useState<{ orderNo: string; amount: number; planName: string; upgradeCredit?: number } | null>(null)
  const [qr, setQr] = useState<string>("")
  const [payError, setPayError] = useState<string>("")
  const [simulating, setSimulating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => setIsMobile(getIsMobile()), [])

  useEffect(() => {
    if (!product) {
      setMe({ member: null, access: false, entitlements: [] })
      return
    }
    fetch(`/api/member/me?product=${encodeURIComponent(product)}`)
      .then((r) => r.json())
      .then((d: Me) => setMe(d))
      .catch(() => setMe({ member: null, access: false, entitlements: [] }))
    fetch(`/api/membership/plans?product=${encodeURIComponent(product)}`)
      .then((r) => r.json())
      .then((d: { name?: string; plans?: Plan[] }) => {
        setPlans(Array.isArray(d.plans) ? d.plans : [])
        if (d.name) setProductName(d.name)
      })
      .catch(() => {})
  }, [product])

  useEffect(() => {
    if (!me?.member || plans.length === 0) return
    let pendingPlan = ""
    try {
      pendingPlan = sessionStorage.getItem(pendingPlanStorageKey) || ""
    } catch {
      /* ignore */
    }
    if (!pendingPlan || !plans.some((p) => p.key === pendingPlan)) return
    setSelectedPlanKey(pendingPlan)
    try {
      sessionStorage.removeItem(pendingPlanStorageKey)
    } catch {
      /* ignore */
    }
  }, [me?.member, pendingPlanStorageKey, plans])

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])
  useEffect(() => stopPoll, [stopPoll])

  const currentEntitlement = me?.entitlements.find((e) => e.productKey === product && e.active && !e.revoked) || null
  const hasLifetimeAccess = !!currentEntitlement?.isLifetime
  const hasFiniteAccess = !!currentEntitlement && !currentEntitlement.isLifetime
  const footnoteText = hasFiniteAccess
    ? "权益有效期内再次购买月卡、季度卡或年卡，时长会在当前有效期后自动顺延；如选择升级方案，会按未使用的付费期限自动抵扣。"
    : "一次性付费，不自动续订；购买成功后即可获得所选套餐的产品权益。"

  function actionLabel(plan: Plan): string {
    if (!me?.member) return "立即开通"
    if (hasFiniteAccess && plan.durationDays == null) return "升级权益"
    if (hasFiniteAccess) return "续期"
    return "立即开通"
  }

  const goNext = useCallback(() => {
    router.push(next)
    router.refresh()
  }, [next, router])

  function startPoll(orderNo: string) {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/membership/order/status?orderNo=${encodeURIComponent(orderNo)}`)
        const d = await r.json()
        if (d.status === "PAID") {
          stopPoll()
          toast.success("产品权益已生效")
          goNext()
        }
      } catch {
        /* 轮询失败忽略 */
      }
    }, 2500)
  }

  async function buy(planKey: string) {
    if (!planKey || buyingKey) return
    // 手机端没法扫自己屏幕 → 去「复制链接到电脑」面板（不下单、不出码）
    if (isMobile) {
      setStep("mobile")
      return
    }
    // 未登录：先去登录页，登录后回到下单页。
    if (!me?.member) {
      try {
        sessionStorage.setItem(pendingPlanStorageKey, planKey)
      } catch {
        /* ignore */
      }
      const back = `/member/join?product=${encodeURIComponent(product)}&next=${encodeURIComponent(next)}`
      router.push(`/member/login?next=${encodeURIComponent(back)}`)
      return
    }
    setSelectedPlanKey(planKey)
    setBuyingKey(planKey)
    setPayError("")
    try {
      const r1 = await fetch("/api/membership/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey,
          product,
        }),
      })
      const d1 = await r1.json()
      if (!r1.ok) {
        toast.error(d1.error || "开通失败")
        return
      }
      setOrder({ orderNo: d1.orderNo, amount: d1.amount, planName: d1.planName, upgradeCredit: d1.upgradeCredit || 0 })
      setStep("pay")
      const r2 = await fetch("/api/membership/pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo: d1.orderNo }),
      })
      const d2 = await r2.json()
      if (r2.ok && d2.qr_data_url) setQr(d2.qr_data_url)
      else setPayError(d2.error || "二维码生成失败")
      startPoll(d1.orderNo)
    } catch {
      toast.error("网络错误，请重试")
    } finally {
      setBuyingKey("")
    }
  }

  async function simulate() {
    if (!order) return
    setSimulating(true)
    try {
      const r = await fetch("/api/membership/pay/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo: order.orderNo }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || "模拟失败")
        return
      }
      stopPoll()
      toast.success("（模拟）产品权益已生效")
      goNext()
    } catch {
      toast.error("网络错误")
    } finally {
      setSimulating(false)
    }
  }

  if (!product) {
    return (
      <MemberAuthShell>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">请选择产品</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">购买入口需要明确指定产品标识。</p>
        <Button className="mt-6 w-full" onClick={() => router.push("/")}>返回网站</Button>
      </MemberAuthShell>
    )
  }

  // —— 加载中 ——
  if (me === null) {
    return (
      <MemberAuthShell>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </MemberAuthShell>
    )
  }

  // —— 已有长期权益 / 全站通会员：无需再购买 ——
  if (hasLifetimeAccess || (me.access && !currentEntitlement)) {
    return (
      <MemberAuthShell>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          你已拥有通行权益
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">无需重复购买，这个产品的访问权益已经生效。</p>
        <Button className="mt-6 w-full" onClick={goNext}>
          进入产品
        </Button>
      </MemberAuthShell>
    )
  }

  // —— 手机端：复制链接到电脑开通 ——
  if (step === "mobile") {
    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}/member/join?product=${encodeURIComponent(product)}&next=${encodeURIComponent(next)}`
        : ""
    return (
      <MemberAuthShell>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">到电脑开通</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">复制链接，在电脑浏览器打开即可。</p>
        <Button
          className="mt-5 w-full"
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(link).then(() => toast.success("链接已复制")).catch(() => toast.error("复制失败，请重试"))
            } else {
              toast.error("复制失败，请重试")
            }
          }}
        >
          复制链接
        </Button>
        <button
          type="button"
          className="mt-3 w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setStep("plans")}
        >
          ← 返回
        </button>
      </MemberAuthShell>
    )
  }

  // —— 微信扫码支付 ——
  if (step === "pay" && order) {
    const reselectBtn = (
      <button
        type="button"
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => {
          stopPoll()
          setStep("plans")
          setOrder(null)
          setQr("")
          setPayError("")
        }}
      >
        <i className="ri-arrow-left-line" /> 重新选
      </button>
    )

    return (
      <MemberAuthShell back={reselectBtn}>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">微信扫码开通权益</h1>
        <p className="mt-2 flex items-baseline gap-2 text-sm text-muted-foreground">
          <span>{order.planName}</span>
          {!!order.upgradeCredit && (
            <>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" aria-hidden />
              <span className="text-xs text-[#EF7627]">已抵扣 ¥{order.upgradeCredit}</span>
            </>
          )}
          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" aria-hidden />
          <span className="text-xs">应付</span>
          <span className="font-serif text-2xl font-bold leading-none" style={{ color: "#EF7627" }}>
            ¥{order.amount}
          </span>
        </p>
        <div className="mt-6 flex flex-col items-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="微信支付二维码" className="h-56 w-56 rounded-xl border border-border bg-white p-2" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {payError || "正在生成二维码…"}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">支付前请确认产品、套餐与有效期；本地模拟不会发起真实扣款。</p>
        {isDev && (
          <Button variant="outline" className="mt-6 w-full" onClick={simulate} disabled={simulating}>
            {simulating ? "处理中…" : "（开发）模拟通行"}
          </Button>
        )}
      </MemberAuthShell>
    )
  }

  // —— 定价页（选套餐）——
  return (
    <MemberPageBg className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl flex-col">
        {/* 返回调用方提供的产品入口。 */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.location.href = next
          }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <i className="ri-arrow-left-line" /> 返回
        </button>
        {/* 品牌头 */}
        <div className="mx-auto w-full max-w-4xl text-center">
          <div className="mb-5 flex justify-center">
            <SiteStatBadge />
          </div>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {productName}
          </h1>
        </div>

        {/* 价值点 */}
        <div className="mx-auto mt-9 grid w-full max-w-4xl gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.text} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-5 py-4">
              <i className={`${b.icon} text-lg`} style={{ color: "#EF7627" }} />
              <span className="text-sm leading-snug text-foreground">{b.text}</span>
            </div>
          ))}
        </div>

        {hasFiniteAccess && (
          <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-2 rounded-xl border border-[#EF7627]/25 bg-[#EF7627]/10 px-5 py-4 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-semibold">当前通行至 {fmtDate(currentEntitlement?.expiresAt ?? null)}</span>
              <p className="mt-1 text-xs text-muted-foreground">
                购买月卡、季度卡或年卡会在当前有效期后顺延；如选择升级方案，会按未使用的付费通行期自动抵扣。
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[#EF7627]">续期 / 升级</span>
          </div>
        )}

        {/* 套餐卡片 */}
        {plans.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">暂无可购买的套餐，稍后再来。</p>
        ) : (
          <div
            className={`mx-auto mt-12 grid w-full gap-6 lg:gap-7 ${
              plans.length === 1
                ? "max-w-sm"
                : plans.length === 2
                  ? "max-w-3xl sm:grid-cols-2"
                  : plans.length === 3
                    ? "max-w-5xl sm:grid-cols-3"
                    : "max-w-6xl sm:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {plans.map((p) => {
              const recommended = p.recommended
              const highlighted = selectedPlanKey ? selectedPlanKey === p.key : recommended
              return (
                <div
                  key={p.key}
                  className={`relative flex min-h-[268px] flex-col rounded-2xl border bg-card p-7 transition lg:p-8 ${
                    highlighted ? "border-[#EF7627] shadow-lg ring-1 ring-[#EF7627]" : "border-border hover:border-foreground/30"
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-[#EF7627] px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                      {p.badge}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-foreground">{p.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{durationLabel(p.durationDays)}</p>

                  {(() => {
                    const basePrice = p.price
                    const upgradeCredit = p.durationDays == null ? p.upgradeCredit || 0 : 0
                    const showPrice = Math.max(1, basePrice - upgradeCredit)
                    const strike = upgradeCredit > 0 ? basePrice : p.originalPrice
                    return (
                      <>
                        <div className="mt-7 flex items-baseline gap-2">
                          <span className="font-serif text-5xl font-bold leading-none text-foreground">
                            <span className="align-top text-base">¥</span>
                            {showPrice}
                          </span>
                          {strike != null && strike > showPrice && (
                            <span className="text-sm text-muted-foreground line-through">¥{strike}</span>
                          )}
                        </div>
                        {upgradeCredit > 0 && (
                          <p className="mt-2 text-xs font-medium text-[#EF7627]">
                            已按未使用通行期抵扣 ¥{upgradeCredit}
                          </p>
                        )}
                      </>
                    )
                  })()}

                  <div className="mt-8 flex-1" />
                  <Button
                    className={`w-full ${highlighted ? "" : "hover:bg-primary hover:text-primary-foreground"}`}
                    variant={highlighted ? "default" : "outline"}
                    onClick={() => buy(p.key)}
                    disabled={!!buyingKey}
                  >
                    {buyingKey === p.key ? "处理中…" : actionLabel(p)}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* 通用购买提示；部署方应按自身业务补充服务条款。 */}
        <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
          {footnoteText} 权益范围以当前产品页面展示为准。
        </p>
        <footer className="mt-8 flex justify-center text-xs text-muted-foreground">
          <IcpLink className="transition-colors hover:text-foreground" />
        </footer>
      </div>
    </MemberPageBg>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <JoinInner />
    </Suspense>
  )
}
