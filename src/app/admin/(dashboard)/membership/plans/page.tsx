"use client"
/** 套餐管理：改价格、原价、有效天数、开关、早鸟标。 */
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
import { toast } from "sonner"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface Plan {
  id: string
  key: string
  name: string
  price: number
  originalPrice: number | null
  durationDays: number | null
  enabled: boolean
  badge: string | null
  recommended: boolean
  sortOrder: number
}

export default function PlansAdminPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])

  const [plans, setPlans] = useState<Plan[]>([])
  const [products, setProducts] = useState<MembershipProductOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState("")
  const [productsLoading, setProductsLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null)
  const [forbidden, setForbidden] = useState(false)

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
      setPlans([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/admin/membership/plans?product=${encodeURIComponent(selectedProduct)}`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.json()
      })
      .then((d) => setPlans(Array.isArray(d) ? d : []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [selectedProduct])
  useEffect(() => loadProducts(), [loadProducts])
  useEffect(() => load(), [load])

  function update(id: string, patch: Partial<Plan>) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  // 推荐为单选：开一个，其它本地即时关掉（后端保存时也会清同产品其它套餐，二者一致）
  function setRecommended(id: string, val: boolean) {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, recommended: val } : val ? { ...p, recommended: false } : p)),
    )
  }

  async function save(p: Plan) {
    setSaving(p.id)
    try {
      const r = await fetch("/api/admin/membership/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: p.id,
          product: selectedProduct,
          name: p.name,
          price: p.price,
          originalPrice: p.originalPrice,
          durationDays: p.durationDays,
          enabled: p.enabled,
          recommended: p.recommended,
          badge: p.badge,
          sortOrder: p.sortOrder,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("保存失败", "Save failed"))
        return
      }
      toast.success(t("已保存", "Saved"))
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setSaving(null)
    }
  }

  async function remove(p: Plan) {
    setDeleting(p.id)
    try {
      const r = await fetch(
        `/api/admin/membership/plans?id=${encodeURIComponent(p.id)}&product=${encodeURIComponent(selectedProduct)}`,
        {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmText: DANGER_DELETE_CONFIRM_TEXT }),
        },
      )
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("删除失败", "Delete failed"))
        return
      }
      toast.success(t("已删除", "Deleted"))
      setDeleteTarget(null)
      setPlans((prev) => prev.filter((x) => x.id !== p.id))
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
          {t("套餐管理", "Plans")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("改价格、原价、有效天数、上下架、角标、排序、推荐。有效天数留空＝永久；排序数字小的靠前；推荐为单选，前台橙色高亮（同产品只能有一张）。角标是纯文案，不做真实限量。", "Edit price, duration, badge, order, recommended. Empty duration = lifetime; lower order shows first; recommended is single-select (orange highlight); badge is display-only.")}
        </p>
      </div>

      <MembershipSubnav group="sales" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{t("管理产品", "Product")}</p>
          <p className="text-xs text-muted-foreground">
            {t("先选择产品，再查看或修改该产品的套餐。", "Select a product before viewing or editing its plans.")}
          </p>
        </div>
        <ProductScopeSelect
          products={products}
          value={selectedProduct}
          onValueChange={(value) => {
            setSelectedProduct(value)
            setDeleteTarget(null)
          }}
          loading={productsLoading}
        />
      </div>

      {!selectedProduct ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          {t("请选择一个产品。", "Select a product.")}
        </p>
      ) : loading ? (
        <p className="text-muted-foreground">{t("加载中…", "Loading…")}</p>
      ) : forbidden ? (
        <p className="text-muted-foreground">{t("无权限（体验账户仅可浏览）", "No permission")}</p>
      ) : plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          {t("该产品还没有套餐。", "This product has no plans yet.")}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.key}</Badge>
                  <span className={`text-xs ${p.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {p.enabled ? t("售卖中", "On sale") : t("已下架", "Off")}
                  </span>
                </div>
                <Switch checked={p.enabled} onCheckedChange={(v) => update(p.id, { enabled: v })} />
              </div>

              <div className="space-y-1.5">
                <Label>{t("名称", "Name")}</Label>
                <Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("现价 ¥", "Price ¥")}</Label>
                  <Input
                    type="number"
                    value={p.price}
                    onChange={(e) => update(p.id, { price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("原价 ¥（划线）", "Original ¥")}</Label>
                  <Input
                    type="number"
                    value={p.originalPrice ?? ""}
                    onChange={(e) => update(p.id, { originalPrice: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("有效天数", "Days")}</Label>
                  <Input
                    type="number"
                    placeholder={t("留空=永久", "empty=lifetime")}
                    value={p.durationDays ?? ""}
                    onChange={(e) => update(p.id, { durationDays: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("角标", "Badge")}</Label>
                  <Input
                    value={p.badge ?? ""}
                    placeholder={t("如 早鸟", "e.g. 早鸟")}
                    onChange={(e) => update(p.id, { badge: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("排序", "Order")}</Label>
                  <Input
                    type="number"
                    value={p.sortOrder}
                    onChange={(e) => update(p.id, { sortOrder: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("推荐", "Recommended")}</Label>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3">
                    <Switch checked={p.recommended} onCheckedChange={(v) => setRecommended(p.id, v)} />
                    <span className="text-xs text-muted-foreground">
                      {p.recommended ? t("橙色高亮", "On") : t("关", "Off")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button className="flex-1" onClick={() => save(p)} disabled={saving === p.id || deleting === p.id}>
                  {saving === p.id ? t("保存中…", "Saving…") : t("保存", "Save")}
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(p)}
                  disabled={saving === p.id || deleting === p.id}
                >
                  {deleting === p.id ? t("删除中…", "Deleting…") : t("删除", "Delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DangerDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        resourceName={t("套餐", "plan")}
        targetName={deleteTarget?.name ?? ""}
        loading={!!deleteTarget && deleting === deleteTarget.id}
        description={t(
          "删除后前台无法继续售卖这个套餐；历史订单会保留套餐名称快照。当前后台没有套餐新建表单，恢复通常需要重新导入或改数据库。",
          "Deleting removes this plan from sale; historical orders keep the plan name snapshot.",
        )}
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget)
        }}
      />
    </div>
  )
}
