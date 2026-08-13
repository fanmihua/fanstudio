"use client"
/** 会员事件日志：支付、回调、清理任务的只读排查视图。 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface MembershipEvent {
  id: string
  type: string
  level: "INFO" | "WARN" | "ERROR" | string
  message: string
  orderNo: string | null
  email: string | null
  metadata: unknown
  createdAt: string
}

const EVENT_TYPES = [
  "ORDER_CREATED",
  "ORDER_REUSED",
  "PAY_QR_CREATED",
  "PAY_QR_FAILED",
  "PAYMENT_NOTIFY_RECEIVED",
  "PAYMENT_NOTIFY_IGNORED",
  "PAYMENT_AMOUNT_MISMATCH",
  "PAYMENT_APPLIED",
  "PAYMENT_DUPLICATE",
  "CLEANUP_PENDING_CANCELLED",
]

const TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  ORDER_CREATED: { zh: "创建订单", en: "Order created" },
  ORDER_REUSED: { zh: "复用订单", en: "Order reused" },
  PAY_QR_CREATED: { zh: "生成支付码", en: "QR created" },
  PAY_QR_FAILED: { zh: "支付码失败", en: "QR failed" },
  PAYMENT_NOTIFY_RECEIVED: { zh: "收到回调", en: "Notify received" },
  PAYMENT_NOTIFY_IGNORED: { zh: "忽略回调", en: "Notify ignored" },
  PAYMENT_AMOUNT_MISMATCH: { zh: "金额异常", en: "Amount mismatch" },
  PAYMENT_APPLIED: { zh: "开通权益", en: "Access applied" },
  PAYMENT_DUPLICATE: { zh: "重复回调", en: "Duplicate notify" },
  CLEANUP_PENDING_CANCELLED: { zh: "清理待支付", en: "Pending cleanup" },
}

export default function MembershipEventsPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])

  const [events, setEvents] = useState<MembershipEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [levelFilter, setLevelFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ level: levelFilter, type: typeFilter })
    const q = search.trim()
    if (q) params.set("q", q)
    fetch(`/api/admin/membership/events?${params.toString()}`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.json()
      })
      .then((d) => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [levelFilter, search, typeFilter])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const levelVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    if (level === "ERROR") return "destructive"
    if (level === "WARN") return "outline"
    return "secondary"
  }

  const chip = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm transition ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`

  const hasFilters = useMemo(
    () => !!search.trim() || levelFilter !== "all" || typeFilter !== "all",
    [levelFilter, search, typeFilter],
  )

  const formatType = (type: string) => {
    const label = TYPE_LABELS[type]
    return label ? (locale === "en" ? label.en : label.zh) : type
  }

  const formatMeta = (metadata: unknown) => {
    if (!metadata || typeof metadata !== "object") return ""
    return JSON.stringify(metadata)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
            {t("会员日志", "Membership Logs")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("支付、回调、自动清理等关键事件。", "Payment, notify, and cleanup events.")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? t("刷新中…", "Refreshing…") : t("刷新", "Refresh")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("搜索邮箱 / 订单号 / 信息…", "Search email / order no. / message…")}
            className="h-9 w-full max-w-sm"
          />
          <div className="flex gap-1">
            {[
              ["all", t("全部级别", "All levels")],
              ["ERROR", "ERROR"],
              ["WARN", "WARN"],
              ["INFO", "INFO"],
            ].map(([k, label]) => (
              <button key={k} onClick={() => setLevelFilter(k)} className={chip(levelFilter === k)}>
                {label}
              </button>
            ))}
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("全部事件", "All events")}</SelectItem>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("时间", "Time")}</TableHead>
              <TableHead>{t("级别", "Level")}</TableHead>
              <TableHead>{t("事件", "Event")}</TableHead>
              <TableHead>{t("会员", "Member")}</TableHead>
              <TableHead>{t("订单号", "Order No.")}</TableHead>
              <TableHead>{t("信息", "Message")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("加载中…", "Loading…")}
                </TableCell>
              </TableRow>
            ) : forbidden ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("无权限（体验账户仅可浏览）", "No permission")}
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {hasFilters ? t("没有符合条件的日志", "No matching logs") : t("暂无日志", "No logs")}
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={levelVariant(event.level)}>{event.level}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatType(event.type)}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{event.email || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{event.orderNo || "—"}</TableCell>
                  <TableCell className="max-w-[360px]">
                    <div>{event.message}</div>
                    {formatMeta(event.metadata) && (
                      <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {formatMeta(event.metadata)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
