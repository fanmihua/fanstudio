"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IcpLink } from "@/components/frontend/IcpLink"
import { MemberPageBg } from "@/components/member/MemberAuthShell"

interface Entitlement {
  productKey: string
  productName: string
  isLifetime: boolean
  expiresAt: string | null
  active: boolean
  revoked: boolean
}

interface Me {
  member: { email: string } | null
  entitlements: Entitlement[]
}

interface Order {
  orderNo: string
  planName: string
  amount: number
  status: string
  source: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  PAID: "已完成",
  PENDING: "待完成",
  REFUNDED: "已退款",
  FAILED: "已失败",
  CANCELLED: "已取消",
}

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800",
  PENDING: "bg-amber-100 text-amber-800",
  REFUNDED: "bg-muted text-muted-foreground",
  FAILED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
}

function formatDate(value: string | null): string {
  if (!value) return ""
  return new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
}

function entitlementStatus(entitlement: Entitlement): string {
  if (entitlement.revoked) return "已停用"
  if (entitlement.isLifetime) return "长期有效"
  if (entitlement.active) return `有效至 ${formatDate(entitlement.expiresAt)}`
  return "已过期"
}

function MemberFooter() {
  return (
    <footer className="mt-10 flex justify-center text-xs text-muted-foreground">
      <IcpLink className="transition-colors hover:text-foreground" />
    </footer>
  )
}

export default function MemberCenter() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    fetch("/api/member/me", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: Me) => setMe(data))
      .catch(() => setMe({ member: null, entitlements: [] }))
    fetch("/api/member/orders", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: { orders: Order[] }) => setOrders(Array.isArray(data.orders) ? data.orders : []))
      .catch(() => {})
  }, [])

  async function logout() {
    await fetch("/api/member/auth/logout", { method: "POST" })
    router.push("/member/login")
    router.refresh()
  }

  if (me === null) {
    return (
      <MemberPageBg className="flex flex-col px-4">
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">加载中…</div>
        <MemberFooter />
      </MemberPageBg>
    )
  }

  if (!me.member) {
    return (
      <MemberPageBg className="flex flex-col px-4">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold text-foreground">请先登录</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">登录后查看产品权益与订单记录。</p>
            <Button className="mt-6" onClick={() => router.push("/member/login?next=/member")}>
              去登录 / 注册
            </Button>
          </div>
        </div>
        <MemberFooter />
      </MemberPageBg>
    )
  }

  const initial = (me.member.email[0] || "?").toUpperCase()

  return (
    <MemberPageBg className="px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <i className="ri-arrow-left-line" /> 返回网站
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-foreground font-mono text-lg font-bold text-background">
            {initial}
          </span>
          <p className="min-w-0 flex-1 truncate font-serif text-xl font-bold text-foreground">{me.member.email}</p>
          <Button variant="outline" size="sm" onClick={logout}>退出登录</Button>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground">我的产品权益</h2>
          {me.entitlements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-9 text-center">
              <p className="text-lg font-semibold text-foreground">暂无产品权益</p>
              <p className="mt-2 text-sm text-muted-foreground">从产品页面选择套餐后，权益会显示在这里。</p>
              <Button variant="outline" className="mt-5" onClick={() => router.push("/")}>浏览网站</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {me.entitlements.map((entitlement) => (
                <div key={entitlement.productKey} className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{entitlement.productName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{entitlementStatus(entitlement)}</p>
                  </div>
                  <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={entitlement.active ? "default" : "secondary"}>
                      {entitlement.active ? "有效" : entitlement.revoked ? "已停用" : "已过期"}
                    </Badge>
                    {!entitlement.isLifetime && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/member/join?product=${encodeURIComponent(entitlement.productKey)}&next=/member`)}
                      >
                        续期 / 升级
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground">订单记录</h2>
          {orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/50 px-5 py-6 text-center text-sm text-muted-foreground">还没有记录</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {orders.map((order, index) => (
                <div key={order.orderNo} className={`flex items-center justify-between px-5 py-4 ${index > 0 ? "border-t border-border" : ""}`}>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      {order.planName}
                      {order.source === "COMP" && <Badge variant="secondary">赠送</Badge>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{formatDate(order.createdAt)} · {order.orderNo}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="font-serif font-bold text-foreground">¥{order.amount}</p>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] ${STATUS_STYLE[order.status] || "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABEL[order.status] || order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <MemberFooter />
      </div>
    </MemberPageBg>
  )
}
