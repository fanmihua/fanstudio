"use client"
/** 会员管理：列表（各产品权益）+ 撤销/改期/封禁。 */
import { useEffect, useState, useCallback, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

interface Entitlement {
  productKey: string
  productName: string
  active: boolean
  isLifetime: boolean
  expiresAt: string | null
  revokedAt: string | null
  source: "PURCHASE" | "COMP"
}
interface Member {
  id: string
  email: string
  name: string | null
  disabled: boolean
  archivedAt: string | null
  createdAt: string
  entitlements: Entitlement[]
  promoUsages: {
    code: string
    orderNo: string
    planName: string
    amount: number
    paidAt: string | null
  }[]
}

type RefundMode = "NONE" | "WECHAT" | "OFFLINE"

interface TransferQuote {
  eligible: boolean
  alreadyCompLifetime: boolean
  suggestedRefundYuan: number
  rawRefundYuan: number
  unusedDays: number
  eligibleOrderCount: number
  canWechatRefund: boolean
}

export default function MembersAdminPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [acting, setActing] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "comp" | "none" | "banned">("all")
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived" | "all">("active")

  const [confirm, setConfirm] = useState<
    | { kind: "revoke"; member: Member; productKey: string; productName: string }
    | { kind: "adjust"; member: Member; productKey: string; productName: string }
    | { kind: "transfer"; member: Member; productKey: string; productName: string }
    | { kind: "ban"; member: Member }
    | null
  >(null)
  const [adjustDays, setAdjustDays] = useState("")
  const [transferQuote, setTransferQuote] = useState<TransferQuote | null>(null)
  const [loadingTransferQuote, setLoadingTransferQuote] = useState(false)
  const [transferRefundMode, setTransferRefundMode] = useState<RefundMode>("NONE")
  const [transferNote, setTransferNote] = useState("管理员赠送长期权益")

  // 站点统计 · 宣传基数
  const [statCfg, setStatCfg] = useState<{ baseVisits: number; basePasses: number; pageViews: number; realPasses: number } | null>(null)
  const [baseVisitsInput, setBaseVisitsInput] = useState("")
  const [basePassesInput, setBasePassesInput] = useState("")
  const [savingStat, setSavingStat] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/membership/members?archive=${archiveFilter}`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.json()
      })
      .then((d) => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [archiveFilter])
  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function patch(memberId: string, body: Record<string, unknown>, okMsg: string) {
    setActing(true)
    try {
      const r = await fetch(`/api/admin/membership/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("操作失败", "Failed"))
        return
      }
      toast.success(okMsg)
      load()
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setActing(false)
      setConfirm(null)
    }
  }

  async function removeMember(member: Member) {
    setDeletingMemberId(member.id)
    try {
      const r = await fetch(`/api/admin/membership/members/${member.id}`, {
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
      setDeletingMemberId(null)
    }
  }

  async function restoreMember(member: Member) {
    setDeletingMemberId(member.id)
    try {
      const r = await fetch(`/api/admin/membership/members/${member.id}`, {
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
      setDeletingMemberId(null)
    }
  }

  function openAdjust(m: Member, e: Entitlement) {
    setAdjustDays("")
    setConfirm({ kind: "adjust", member: m, productKey: e.productKey, productName: e.productName })
  }

  async function openTransfer(m: Member, e: Entitlement) {
    setTransferQuote(null)
    setTransferRefundMode("NONE")
    setTransferNote("管理员赠送长期权益")
    setConfirm({ kind: "transfer", member: m, productKey: e.productKey, productName: e.productName })
    setLoadingTransferQuote(true)
    try {
      const r = await fetch(`/api/admin/membership/members/${m.id}/comp-lifetime?productKey=${encodeURIComponent(e.productKey)}`, {
        credentials: "include",
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("计算失败", "Failed to calculate"))
        setConfirm(null)
        return
      }
      setTransferQuote(d)
    } catch {
      toast.error(t("网络错误", "Network error"))
      setConfirm(null)
    } finally {
      setLoadingTransferQuote(false)
    }
  }

  async function transferToCompLifetime() {
    if (!confirm || confirm.kind !== "transfer") return
    setActing(true)
    try {
      const r = await fetch(`/api/admin/membership/members/${confirm.member.id}/comp-lifetime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          productKey: confirm.productKey,
          refundMode: transferRefundMode,
          note: transferNote,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("转赠送失败", "Transfer failed"))
        return
      }
      toast.success(t("已转为赠送永久", "Transferred"))
      setConfirm(null)
      load()
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setActing(false)
    }
  }

  function entText(e: Entitlement) {
    if (e.revokedAt) return t("已撤销", "Revoked")
    if (e.isLifetime) return t("永久", "Lifetime")
    if (!e.expiresAt) return t("无", "None")
    const d = new Date(e.expiresAt)
    const expired = d.getTime() < Date.now()
    return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN") + (expired ? t("（过期）", " (exp)") : "")
  }

  // 会员状态判定（active 已含「非封禁」，封禁会员的所有权益 active=false）
  const memberKind = useCallback((m: Member) => {
    const activeEnts = m.entitlements.filter((e) => e.active)
    return {
      paid: activeEnts.some((e) => e.source === "PURCHASE"),
      comp: activeEnts.some((e) => e.source === "COMP"),
      hasActive: activeEnts.length > 0,
      banned: m.disabled,
    }
  }, [])

  // 各状态人数（纯前端统计，数据已全量在前端）
  const counts = useMemo(() => {
    const c = { all: members.length, paid: 0, comp: 0, none: 0, banned: 0 }
    for (const m of members) {
      const k = memberKind(m)
      if (k.banned) c.banned++
      if (k.paid) c.paid++
      if (k.comp) c.comp++
      if (!k.hasActive && !k.banned) c.none++
    }
    return c
  }, [members, memberKind])

  // 搜索（邮箱 / 兑换码 / 订单号）+ 状态筛选
  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((m) => {
      const matchSearch =
        !q ||
        m.email.toLowerCase().includes(q) ||
        m.promoUsages.some(
          (u) =>
            u.code.toLowerCase().includes(q) ||
            u.orderNo.toLowerCase().includes(q) ||
            u.planName.toLowerCase().includes(q),
        )
      if (!matchSearch) return false
      const k = memberKind(m)
      switch (statusFilter) {
        case "paid": return k.paid
        case "comp": return k.comp
        case "none": return !k.hasActive && !k.banned // 登录了但无生效权益（含从未开通 / 已过期）
        case "banned": return k.banned
        default: return true
      }
    })
  }, [members, search, statusFilter, memberKind])

  const filterBtns: [typeof statusFilter, string, number][] = [
    ["all", t("全部", "All"), counts.all],
    ["paid", t("付费", "Paid"), counts.paid],
    ["comp", t("赠送", "Comp"), counts.comp],
    ["none", t("未开通", "No access"), counts.none],
    ["banned", t("已封禁", "Banned"), counts.banned],
  ]

  useEffect(() => {
    fetch("/api/admin/stats", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setStatCfg(d)
        setBaseVisitsInput(String(d.baseVisits))
        setBasePassesInput(String(d.basePasses))
      })
      .catch(() => {})
  }, [])

  async function saveStat() {
    if (savingStat) return
    setSavingStat(true)
    try {
      const r = await fetch("/api/admin/stats", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseVisits: Number(baseVisitsInput) || 0, basePasses: Number(basePassesInput) || 0 }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("保存失败", "Save failed"))
        return
      }
      setStatCfg(d)
      setBaseVisitsInput(String(d.baseVisits))
      setBasePassesInput(String(d.basePasses))
      toast.success(t("基数已保存", "Saved"))
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setSavingStat(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">{t("会员管理", "Members")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("查看会员权益，处理撤销、改有效期、封禁和归档。", "Review access and manage revoke, adjust, ban, and archive.")}
        </p>
      </div>

      <MembershipSubnav group="members" />

      {/* 站点统计 · 宣传基数（文章入口、开通页和产品入口的「访问 · 通行」徽标）*/}
      {statCfg && (
        <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
          <div>
            <h2 className="font-semibold text-foreground">{t("站点统计 · 宣传基数", "Site stats · promo base")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "文章文末 / 开通页 / 产品入口展示「X 人访问 · Y 人通行」。访问按独立访客去重；显示值 = 基数 + 真实，真实分量自动累计。",
                "Shown on article CTAs, join pages, and product entry pages. Visits are unique per device; displayed = base + real.",
              )}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("访问基数", "Visits base")}</Label>
              <Input type="number" min={0} value={baseVisitsInput} onChange={(e) => setBaseVisitsInput(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {t("真实访客", "Real visitors")} {statCfg.pageViews.toLocaleString()} · {t("显示", "Show")}{" "}
                <b className="text-foreground">{((Number(baseVisitsInput) || 0) + statCfg.pageViews).toLocaleString()}</b>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("通行基数", "Passes base")}</Label>
              <Input type="number" min={0} value={basePassesInput} onChange={(e) => setBasePassesInput(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {t("真实通行", "Real passes")} {statCfg.realPasses.toLocaleString()} · {t("显示", "Show")}{" "}
                <b className="text-foreground">{((Number(basePassesInput) || 0) + statCfg.realPasses).toLocaleString()}</b>
              </p>
            </div>
          </div>
          <Button onClick={saveStat} disabled={savingStat}>
            {savingStat ? t("保存中…", "Saving…") : t("保存基数", "Save base")}
          </Button>
        </div>
      )}

      {/* 会员列表 */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("搜索邮箱 / 兑换码…", "Search email / promo code…")}
            className="h-9 w-full max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            {filterBtns.map(([k, label, n]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${statusFilter === k ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
              >
                {label} <span className="tabular-nums opacity-60">{n}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              ["active", t("正常", "Active")],
              ["archived", t("已归档", "Archived")],
              ["all", t("含归档", "All")],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setArchiveFilter(k as typeof archiveFilter)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${archiveFilter === k ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("邮箱", "Email")}</TableHead>
              <TableHead>{t("权益（产品 · 有效期）", "Entitlements")}</TableHead>
              <TableHead>{t("账号", "Account")}</TableHead>
              <TableHead className="w-[120px]">{t("操作", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("加载中…", "Loading…")}</TableCell></TableRow>
            ) : forbidden ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("无权限（体验账户仅可浏览）", "No permission")}</TableCell></TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{members.length === 0 ? t("暂无会员", "No members") : t("没有符合条件的会员", "No matching members")}</TableCell></TableRow>
            ) : (
              filteredMembers.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium align-top">
                    {m.email}
                    {m.archivedAt && <div className="mt-1"><Badge variant="outline">{t("已归档", "Archived")}</Badge></div>}
                    {m.promoUsages.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.promoUsages.slice(0, 3).map((u) => (
                          <Badge
                            key={u.orderNo}
                            variant="outline"
                            className="border-[#EF7627]/30 bg-[#EF7627]/10 text-[#EF7627]"
                            title={`${u.planName} · ¥${u.amount} · ${u.orderNo}`}
                          >
                            {t("码", "Code")} {u.code}
                          </Badge>
                        ))}
                        {m.promoUsages.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{m.promoUsages.length - 3}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {m.entitlements.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-1.5">
                        {m.entitlements.map((e) => (
                          <div key={e.productKey} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-foreground">{e.productName}</span>
                            {e.source === "COMP" ? <Badge variant="outline">{t("赠送", "Comp")}</Badge> : <Badge>{t("付费", "Paid")}</Badge>}
                            <span className={e.active ? "text-emerald-600" : "text-muted-foreground"}>{entText(e)}</span>
                            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => openAdjust(m, e)} disabled={acting}>{t("改期", "Adjust")}</button>
                            {e.active && e.source === "PURCHASE" && !e.isLifetime && (
                              <button className="text-xs text-[#EF7627] hover:underline" onClick={() => openTransfer(m, e)} disabled={acting}>{t("转赠送永久", "Comp lifetime")}</button>
                            )}
                            {e.active && (
                              <button className="text-xs text-destructive hover:underline" onClick={() => setConfirm({ kind: "revoke", member: m, productKey: e.productKey, productName: e.productName })} disabled={acting}>{t("撤销", "Revoke")}</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {m.archivedAt ? <Badge variant="outline">{t("已归档", "Archived")}</Badge> : m.disabled ? <Badge variant="destructive">{t("已封禁", "Banned")}</Badge> : <span className="text-xs text-muted-foreground">{t("正常", "OK")}</span>}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col items-start gap-1">
                    {m.archivedAt ? (
                      <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => restoreMember(m)} disabled={acting || deletingMemberId === m.id}>{deletingMemberId === m.id ? t("恢复中…", "Restoring…") : t("恢复", "Restore")}</button>
                    ) : m.disabled ? (
                      <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => patch(m.id, { action: "unban" }, t("已解禁", "Unbanned"))} disabled={acting}>{t("解禁", "Unban")}</button>
                    ) : (
                      <button className="text-sm text-destructive hover:underline" onClick={() => setConfirm({ kind: "ban", member: m })} disabled={acting}>{t("封禁", "Ban")}</button>
                    )}
                      {!m.archivedAt && (
                        <button
                          className="text-sm text-destructive hover:underline"
                          onClick={() => setDeleteTarget(m)}
                          disabled={acting || deletingMemberId === m.id}
                        >
                          {deletingMemberId === m.id ? t("归档中…", "Archiving…") : t("归档", "Archive")}
                        </button>
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
        title={
          confirm?.kind === "revoke"
            ? t("确认撤销权益", "Confirm revoke")
            : confirm?.kind === "adjust"
              ? t("改有效期", "Adjust expiry")
              : confirm?.kind === "transfer"
                ? t("转赠送永久", "Comp lifetime")
                : t("确认封禁账号", "Confirm ban")
        }
        description={
          confirm?.kind === "adjust" ? (
            <div className="space-y-2">
              <p>{confirm.productName} · {confirm.member.email}</p>
              <Label>{t("天数（留空 = 永久，0 = 立即过期）", "Days (empty=lifetime, 0=expire now)")}</Label>
              <Input
                autoFocus
                type="number"
                placeholder={t("如 365", "e.g. 365")}
                value={adjustDays}
                onChange={(ev) => setAdjustDays(ev.target.value)}
              />
              <Label className="pt-1">{t("或直接选到期日（自动换算天数）", "Or pick an expiry date")}</Label>
              <Input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                onChange={(ev) => {
                  const v = ev.target.value
                  if (!v) return
                  const end = new Date(v + "T23:59:59").getTime()
                  setAdjustDays(String(Math.max(0, Math.ceil((end - Date.now()) / 86400000))))
                }}
              />
            </div>
          ) : confirm?.kind === "transfer" ? (
            <div className="space-y-4 text-foreground">
              <div>
                <p className="font-medium">{confirm.productName} · {confirm.member.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("确认后会把当前权益改为赠送永久，并按下面选择处理退款。", "This sets access to comp lifetime and handles refund by your selection.")}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{t("建议退款金额", "Suggested refund")}</p>
                <p className="mt-1 font-serif text-3xl font-bold text-foreground">
                  {loadingTransferQuote ? "…" : `¥${transferQuote?.suggestedRefundYuan ?? 0}`}
                </p>
                {transferQuote && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      `按剩余 ${transferQuote.unusedDays} 天付费通行期折算。`,
                      `Calculated from ${transferQuote.unusedDays} unused paid days.`,
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("退款处理方式", "Refund handling")}</Label>
                {([
                  ["NONE", t("暂不退款", "No refund now"), t("只转赠送永久，先不处理钱。", "Only transfer access for now.")],
                  ["WECHAT", t("微信原路退款", "WeChat refund"), t("按建议金额发起微信部分原路退款。", "Refund suggested amount through WeChat.")],
                  ["OFFLINE", t("线下处理", "Offline handled"), t("不调用微信，只记录你线下处理。", "Record offline handling only.")],
                ] as const).map(([mode, label, desc]) => {
                  const disabled = mode === "WECHAT" && (!transferQuote?.canWechatRefund || (transferQuote?.suggestedRefundYuan ?? 0) <= 0)
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={disabled || loadingTransferQuote}
                      onClick={() => setTransferRefundMode(mode)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        transferRefundMode === mode
                          ? "border-[#EF7627] bg-[#EF7627]/10 text-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted/50"
                      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
                    </button>
                  )
                })}
              </div>

              <div className="space-y-1.5">
                <Label>{t("备注", "Note")}</Label>
                <Input value={transferNote} onChange={(ev) => setTransferNote(ev.target.value)} />
              </div>
            </div>
          ) : confirm?.kind === "revoke" ? (
            t(
              `撤销 ${confirm.member.email} 的「${confirm.productName}」权益？立即断访问，不退款。`,
              `Revoke ${confirm.member.email}'s "${confirm.productName}"? Cuts access, no refund.`,
            )
          ) : confirm ? (
            t(`封禁 ${confirm.member.email}？登录与所有产品访问全断。`, `Ban ${confirm.member.email}? Login & all access blocked.`)
          ) : (
            ""
          )
        }
        confirmLabel={confirm?.kind === "adjust" ? t("保存", "Save") : confirm?.kind === "transfer" ? t("确认转赠送永久", "Confirm transfer") : t("确认", "Confirm")}
        loading={acting || (confirm?.kind === "transfer" && loadingTransferQuote)}
        variant={confirm?.kind === "adjust" || confirm?.kind === "transfer" ? "default" : "destructive"}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === "revoke") {
            patch(confirm.member.id, { action: "revoke", productKey: confirm.productKey }, t("已撤销", "Revoked"))
          } else if (confirm.kind === "adjust") {
            const trimmed = adjustDays.trim()
            const days = trimmed === "" ? null : Number(trimmed)
            if (days !== null && !Number.isInteger(days)) {
              toast.error(t("天数无效", "Invalid days"))
              return
            }
            patch(confirm.member.id, { action: "adjust", productKey: confirm.productKey, days }, t("有效期已更新", "Updated"))
          } else if (confirm.kind === "transfer") {
            transferToCompLifetime()
          } else {
            patch(confirm.member.id, { action: "ban" }, t("已封禁", "Banned"))
          }
        }}
      />

      <DangerDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        resourceName={t("会员账号", "member account")}
        targetName={deleteTarget?.email ?? ""}
        loading={!!deleteTarget && deletingMemberId === deleteTarget.id}
        description={t(
          "会把该会员移入归档、清掉当前登录会话，并禁止继续登录/访问；订单和权益记录会保留，后续可恢复。",
          "This archives the member, clears active sessions, and blocks login/access. Orders and entitlements are preserved.",
        )}
        onConfirm={async () => {
          if (deleteTarget) await removeMember(deleteTarget)
        }}
      />
    </div>
  )
}
