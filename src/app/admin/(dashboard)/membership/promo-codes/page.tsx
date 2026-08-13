"use client"
/** 折扣码管理：按产品控制折扣、数量、有效期、适用套餐和开关。 */
import { useEffect, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DangerDeleteDialog } from "@/components/admin/DangerDeleteDialog"
import { MembershipSubnav } from "@/components/admin/membership/MembershipSubnav"
import { ProductScopeSelect, type MembershipProductOption } from "@/components/admin/membership/ProductScopeSelect"
import { DANGER_DELETE_CONFIRM_TEXT } from "@/lib/admin-delete-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface Code {
  id: string
  code: string
  planKey: string | null
  percentOff: number
  maxRedemptions: number | null
  redeemedCount: number
  startsAt: string | null
  expiresAt: string | null
  enabled: boolean
  note: string | null
}
interface PlanOption {
  key: string
  name: string
}
// datetime-local 需要 'YYYY-MM-DDTHH:mm'
function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const EMPTY_NEW_CODE = { code: "", zhe: "8", maxRedemptions: "", expiresAt: "", planKey: "ALL", note: "" }

export default function PromoCodesAdminPage() {
  const [codes, setCodes] = useState<Code[]>([])
  const [products, setProducts] = useState<MembershipProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Code | null>(null)
  const [nc, setNc] = useState(EMPTY_NEW_CODE)
  const [creating, setCreating] = useState(false)

  const loadProducts = useCallback(() => {
    setProductsLoading(true)
    fetch("/api/admin/membership/products", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.json()
      })
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [])

  const load = useCallback(() => {
    if (!selectedProduct) {
      setCodes([])
      setPlanOptions([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/membership/promo-codes?product=${encodeURIComponent(selectedProduct)}`, { credentials: "include" }),
      fetch(`/api/admin/membership/plans?product=${encodeURIComponent(selectedProduct)}`, { credentials: "include" }),
    ])
      .then(async ([codesResponse, plansResponse]) => {
        if (codesResponse.status === 403 || plansResponse.status === 403) {
          setForbidden(true)
          return { codes: [], plans: [] }
        }
        const [nextCodes, nextPlans] = await Promise.all([codesResponse.json(), plansResponse.json()])
        return {
          codes: Array.isArray(nextCodes) ? nextCodes : [],
          plans: Array.isArray(nextPlans)
            ? nextPlans.map((plan: PlanOption) => ({ key: plan.key, name: plan.name }))
            : [],
        }
      })
      .then((data) => {
        setCodes(data.codes)
        setPlanOptions(data.plans)
      })
      .catch(() => {
        setCodes([])
        setPlanOptions([])
      })
      .finally(() => setLoading(false))
  }, [selectedProduct])
  useEffect(() => loadProducts(), [loadProducts])
  useEffect(() => load(), [load])

  const selectablePlans = [{ key: "ALL", name: "该产品全部套餐" }, ...planOptions]

  function update(id: string, patch: Partial<Code>) {
    setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function create() {
    const zhe = Number(nc.zhe)
    if (!selectedProduct) return toast.error("请先选择产品")
    if (!nc.code.trim()) return toast.error("请输入码串")
    if (!(zhe > 0 && zhe < 10)) return toast.error("折扣需在 0–10 之间(8=8 折)")
    setCreating(true)
    try {
      const r = await fetch("/api/admin/membership/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: nc.code,
          product: selectedProduct,
          percentOff: Math.round((10 - zhe) * 10),
          planKey: nc.planKey,
          maxRedemptions: nc.maxRedemptions || null,
          expiresAt: nc.expiresAt || null,
          note: nc.note || null,
        }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || "创建失败")
      toast.success("已创建")
      setNc(EMPTY_NEW_CODE)
      load()
    } catch {
      toast.error("网络错误")
    } finally {
      setCreating(false)
    }
  }

  async function save(c: Code) {
    setSaving(c.id)
    try {
      const r = await fetch("/api/admin/membership/promo-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: c.id,
          product: selectedProduct,
          code: c.code,
          percentOff: c.percentOff,
          planKey: c.planKey ?? "ALL",
          maxRedemptions: c.maxRedemptions,
          expiresAt: c.expiresAt,
          enabled: c.enabled,
          note: c.note,
        }),
      })
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || "保存失败")
      toast.success("已保存")
    } catch {
      toast.error("网络错误")
    } finally {
      setSaving(null)
    }
  }

  async function remove(c: Code) {
    try {
      const r = await fetch(
        `/api/admin/membership/promo-codes?id=${encodeURIComponent(c.id)}&product=${encodeURIComponent(selectedProduct)}`,
        {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmText: DANGER_DELETE_CONFIRM_TEXT }),
        },
      )
      const d = await r.json()
      if (!r.ok) return toast.error(d.error || "删除失败")
      toast.success("已删除")
      setDeleteTarget(null)
      setCodes((prev) => prev.filter((x) => x.id !== c.id))
    } catch {
      toast.error("网络错误")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">折扣码</h1>
        <p className="mt-1 text-muted-foreground">
          为指定产品创建公开折扣口令，并设置折扣、数量、有效期和适用套餐。每个账号限用一次；停用或删除立即失效。
        </p>
      </div>

      <MembershipSubnav group="marketing" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">管理产品</p>
          <p className="text-xs text-muted-foreground">先选择产品，再查看或创建该产品的折扣码。</p>
        </div>
        <ProductScopeSelect
          products={products}
          value={selectedProduct}
          onValueChange={(value) => {
            setSelectedProduct(value)
            setNc(EMPTY_NEW_CODE)
            setDeleteTarget(null)
          }}
          loading={productsLoading}
        />
      </div>

      {/* 新建 */}
      {selectedProduct && (
      <div className="rounded-2xl border border-border/50 bg-card/50 p-5">
        <h2 className="mb-3 font-semibold text-foreground">新建折扣码</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>码串(大小写不敏感)</Label>
            <Input value={nc.code} placeholder="WELCOME20" onChange={(e) => setNc({ ...nc, code: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>打几折(8 = 8 折)</Label>
            <Input type="number" step="0.5" value={nc.zhe} onChange={(e) => setNc({ ...nc, zhe: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              立减 {Number(nc.zhe) > 0 && Number(nc.zhe) < 10 ? Math.round((10 - Number(nc.zhe)) * 10) : "—"}%
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>适用套餐</Label>
            <Select value={nc.planKey} onValueChange={(planKey) => setNc({ ...nc, planKey })}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectablePlans.map((plan) => (
                  <SelectItem key={plan.key} value={plan.key}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>数量(留空=不限)</Label>
            <Input type="number" value={nc.maxRedemptions} placeholder="如 200" onChange={(e) => setNc({ ...nc, maxRedemptions: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>有效期至(留空=永不)</Label>
            <Input type="datetime-local" value={nc.expiresAt} onChange={(e) => setNc({ ...nc, expiresAt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>备注</Label>
            <Input value={nc.note} placeholder="如 周年活动" onChange={(e) => setNc({ ...nc, note: e.target.value })} />
          </div>
        </div>
        <Button className="mt-4" onClick={create} disabled={creating}>
          {creating ? "创建中…" : "创建"}
        </Button>
      </div>
      )}

      {/* 列表 */}
      {forbidden ? (
        <p className="text-muted-foreground">无权限（体验账户仅可浏览）</p>
      ) : !selectedProduct ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          请选择一个产品。
        </p>
      ) : loading ? (
        <p className="text-muted-foreground">加载中…</p>
      ) : codes.length === 0 ? (
        <p className="text-muted-foreground">该产品还没有折扣码。</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {codes.map((c) => (
            <div key={c.id} className="space-y-3 rounded-2xl border border-border/50 bg-card/50 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {c.code}
                  </Badge>
                  <span className={`text-xs ${c.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {c.enabled ? "启用" : "停用"}
                  </span>
                </div>
                <Switch checked={c.enabled} onCheckedChange={(v) => update(c.id, { enabled: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>打几折</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={(100 - c.percentOff) / 10}
                    onChange={(e) => {
                      const z = Number(e.target.value)
                      if (z > 0 && z < 10) update(c.id, { percentOff: Math.round((10 - z) * 10) })
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>适用套餐</Label>
                  <Select
                    value={c.planKey ?? "ALL"}
                    onValueChange={(planKey) => update(c.id, { planKey: planKey === "ALL" ? null : planKey })}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(c.planKey && !selectablePlans.some((plan) => plan.key === c.planKey)
                        ? [...selectablePlans, { key: c.planKey, name: `${c.planKey}（已无对应套餐）` }]
                        : selectablePlans
                      ).map((plan) => (
                        <SelectItem key={plan.key} value={plan.key}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>数量(留空=不限)</Label>
                  <Input
                    type="number"
                    value={c.maxRedemptions ?? ""}
                    onChange={(e) => update(c.id, { maxRedemptions: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>有效期至</Label>
                  <Input
                    type="datetime-local"
                    value={toLocalInput(c.expiresAt)}
                    onChange={(e) => update(c.id, { expiresAt: e.target.value || null })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                已用 {c.redeemedCount}
                {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""} 次{c.note ? ` · ${c.note}` : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button className="flex-1" onClick={() => save(c)} disabled={saving === c.id}>
                  {saving === c.id ? "保存中…" : "保存"}
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(c)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DangerDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        resourceName="折扣码"
        targetName={deleteTarget?.code ?? ""}
        loading={false}
        description="删除后该码立即失效；历史订单仍保留它用过的码串快照。"
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget)
        }}
      />
    </div>
  )
}
