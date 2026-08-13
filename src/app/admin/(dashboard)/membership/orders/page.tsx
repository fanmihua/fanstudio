"use client"
/** 会员订单：列表 + 状态/来源筛选 + 退款（仅微信付费单可退）。 */
import { useEffect, useState, useCallback, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog"
import { DangerDeleteDialog } from "@/components/admin/DangerDeleteDialog"
import { MembershipSubnav } from "@/components/admin/membership/MembershipSubnav"
import { DANGER_DELETE_CONFIRM_TEXT } from "@/lib/admin-delete-guard"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface MOrder {
  id: string
  orderNo: string
  email: string
  planName: string
  source: "PURCHASE" | "COMP"
  amount: number
  status: string
  isLifetime: boolean
  grantsDays: number | null
  note: string | null
  promoCode: string | null
  hasPayment: boolean
  paidAt: string | null
  archivedAt: string | null
  createdAt: string
}

export default function MembershipOrdersPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])

  const [orders, setOrders] = useState<MOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [promoFilter, setPromoFilter] = useState<"all" | "with" | "none">("all")
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived" | "all">("active")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [refunding, setRefunding] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<MOrder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MOrder | null>(null)

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: t("待支付", "Pending"), variant: "outline" },
    PAID: { label: t("已支付", "Paid"), variant: "default" },
    CANCELLED: { label: t("已取消", "Cancelled"), variant: "destructive" },
    REFUNDED: { label: t("已退款", "Refunded"), variant: "destructive" },
  }

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      archive: archiveFilter,
      status: statusFilter,
      source: sourceFilter,
      promo: promoFilter,
    })
    const q = search.trim()
    if (q) params.set("q", q)
    fetch(`/api/admin/membership/orders?${params.toString()}`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.json()
      })
      .then((d) => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [archiveFilter, promoFilter, search, sourceFilter, statusFilter])
  useEffect(() => load(), [load])
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  async function refund(o: MOrder) {
    setRefunding(o.id)
    try {
      const r = await fetch(`/api/admin/membership/orders/${o.id}/refund`, {
        method: "POST",
        credentials: "include",
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("退款失败", "Refund failed"))
        return
      }
      toast.success(t("已退款，会员有效期已扣减", "Refunded"))
      load()
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setRefunding(null)
      setConfirm(null)
    }
  }

  async function remove(o: MOrder) {
    setDeleting(o.id)
    try {
      const r = await fetch(`/api/admin/membership/orders?id=${encodeURIComponent(o.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmText: DANGER_DELETE_CONFIRM_TEXT }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("删除失败", "Delete failed"))
        return
      }
      toast.success(t("已归档", "Archived"))
      setDeleteTarget(null)
      load()
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setDeleting(null)
    }
  }

  async function restore(o: MOrder) {
    setDeleting(o.id)
    try {
      const r = await fetch(`/api/admin/membership/orders?id=${encodeURIComponent(o.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "restore" }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("恢复失败", "Restore failed"))
        return
      }
      toast.success(t("已恢复", "Restored"))
      load()
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setDeleting(null)
    }
  }

  const filtered = useMemo(() => orders, [orders])
  const hasFilters =
    !!search.trim() || statusFilter !== "all" || sourceFilter !== "all" || promoFilter !== "all" || archiveFilter !== "active"

  const chip = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm transition ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
          {t("会员订单", "Membership Orders")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("付费购买与赠送记录。退款仅对微信付费单开放。", "Purchases & comps. Refund only for WeChat-paid orders.")}
        </p>
      </div>

      <MembershipSubnav group="members" />

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("搜索邮箱 / 订单号 / 兑换码…", "Search email / order no. / promo code…")}
            className="h-9 w-full max-w-sm"
          />
          <div className="flex gap-1">
            {[["all", t("全部状态", "All status")], ["PAID", t("已支付", "Paid")], ["PENDING", t("待支付", "Pending")], ["REFUNDED", t("已退款", "Refunded")]].map(([k, label]) => (
              <button key={k} onClick={() => setStatusFilter(k)} className={chip(statusFilter === k)}>{label}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {[["all", t("全部来源", "All source")], ["PURCHASE", t("付费", "Paid")], ["COMP", t("赠送", "Comp")]].map(([k, label]) => (
              <button key={k} onClick={() => setSourceFilter(k)} className={chip(sourceFilter === k)}>{label}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {[
              ["all", t("全部兑换", "All promos")],
              ["with", t("用了兑换", "With promo")],
              ["none", t("未用兑换", "No promo")],
            ].map(([k, label]) => (
              <button key={k} onClick={() => setPromoFilter(k as typeof promoFilter)} className={chip(promoFilter === k)}>{label}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {[
              ["active", t("正常", "Active")],
              ["archived", t("已归档", "Archived")],
              ["all", t("含归档", "All")],
            ].map(([k, label]) => (
              <button key={k} onClick={() => setArchiveFilter(k as typeof archiveFilter)} className={chip(archiveFilter === k)}>{label}</button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("订单号", "Order No.")}</TableHead>
              <TableHead>{t("会员", "Member")}</TableHead>
              <TableHead>{t("套餐", "Plan")}</TableHead>
              <TableHead>{t("来源", "Source")}</TableHead>
              <TableHead>{t("金额", "Amount")}</TableHead>
              <TableHead>{t("状态", "Status")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("时间", "Time")}</TableHead>
              <TableHead className="w-[140px]">{t("操作", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("加载中…", "Loading…")}</TableCell></TableRow>
            ) : forbidden ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("无权限（体验账户仅可浏览）", "No permission")}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{hasFilters ? t("没有符合条件的订单", "No matching orders") : t("暂无订单", "No orders")}</TableCell></TableRow>
            ) : (
              filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{o.email}</TableCell>
                  <TableCell>
                    {o.planName}
                    {o.note && <div className="text-xs text-muted-foreground">{o.note}</div>}
                  </TableCell>
                  <TableCell>
                    {o.source === "PURCHASE" ? <Badge>{t("付费", "Paid")}</Badge> : <Badge variant="outline">{t("赠送", "Comp")}</Badge>}
                  </TableCell>
                  <TableCell>
                    {o.amount > 0 ? `¥${o.amount}` : t("赠送", "Free")}
                    {o.promoCode && (
                      <div className="mt-0.5 inline-block rounded bg-[#EF7627]/10 px-1.5 py-0.5 text-xs font-medium text-[#EF7627]">
                        {t("码", "Code")} {o.promoCode}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusMap[o.status]?.variant || "default"}>{statusMap[o.status]?.label || o.status}</Badge>
                    {o.archivedAt && <div className="mt-1"><Badge variant="outline">{t("已归档", "Archived")}</Badge></div>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                    {o.status === "PAID" && o.source === "PURCHASE" && o.hasPayment ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={refunding === o.id}
                        onClick={() => setConfirm(o)}
                      >
                        {refunding === o.id ? "…" : t("退款", "Refund")}
                      </Button>
                    ) : null}
                      {o.archivedAt ? (
                        <Button variant="ghost" size="sm" disabled={deleting === o.id} onClick={() => restore(o)}>
                          {deleting === o.id ? "…" : t("恢复", "Restore")}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={deleting === o.id}
                          onClick={() => setDeleteTarget(o)}
                        >
                          {deleting === o.id ? "…" : t("归档", "Archive")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmActionDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t("确认退款", "Confirm Refund")}
        description={
          confirm
            ? t(
                `确定对订单 ${confirm.orderNo}（¥${confirm.amount}）原路退款吗？将同时扣减该会员有效期，不可撤销。`,
                `Refund order ${confirm.orderNo} (¥${confirm.amount})? Member access will be reduced. Cannot be undone.`,
              )
            : ""
        }
        confirmLabel={t("确认退款", "Confirm Refund")}
        loading={!!confirm && refunding === confirm.id}
        variant="destructive"
        onConfirm={async () => {
          if (confirm) await refund(confirm)
        }}
      />

      <DangerDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        resourceName={t("会员订单", "membership order")}
        targetName={deleteTarget?.orderNo ?? ""}
        loading={!!deleteTarget && deleting === deleteTarget.id}
        description={t(
          "只把订单移入归档，默认列表会隐藏；不会自动退款，也不会自动撤销会员访问。需要时可切到「已归档」恢复。",
          "This archives the order. It will not refund or revoke access, and can be restored.",
        )}
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget)
        }}
      />
    </div>
  )
}
