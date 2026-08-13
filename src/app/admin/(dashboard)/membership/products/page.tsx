"use client"
/** 产品管理：维护可售产品、入口路径、启用状态、全站权益与排序。 */
import { useEffect, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog"
import { MembershipSubnav } from "@/components/admin/membership/MembershipSubnav"
import { toast } from "sonner"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface Product {
  id: string
  key: string
  name: string
  blurb: string | null
  landingPath: string | null
  enabled: boolean
  isAllAccess: boolean
  sortOrder: number
}

export default function ProductsAdminPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [newKey, setNewKey] = useState("")
  const [newName, setNewName] = useState("")
  const [newLandingPath, setNewLandingPath] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  const load = useCallback(() => {
    setLoading(true)
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
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => load(), [load])

  function update(id: string, patch: Partial<Product>) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  async function save(p: Product) {
    setSaving(p.id)
    try {
      const r = await fetch("/api/admin/membership/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: p.id,
          name: p.name,
          blurb: p.blurb,
          landingPath: p.landingPath,
          enabled: p.enabled,
          isAllAccess: p.isAllAccess,
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

  async function create() {
    if (!newKey.trim() || !newName.trim()) {
      toast.error(t("请填 key 和名称", "Enter key & name"))
      return
    }
    setCreating(true)
    try {
      const r = await fetch("/api/admin/membership/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          key: newKey.trim(),
          name: newName.trim(),
          landingPath: newLandingPath.trim() || null,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("新建失败", "Failed"))
        return
      }
      toast.success(t("已新建", "Created"))
      setNewKey("")
      setNewName("")
      setNewLandingPath("")
      load()
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setCreating(false)
    }
  }

  async function remove(p: Product) {
    setSaving(p.id)
    try {
      const r = await fetch(`/api/admin/membership/products?id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("删除失败", "Delete failed"))
        return
      }
      toast.success(t("已删除", "Deleted"))
      setDeleteTarget(null)
      setProducts((prev) => prev.filter((x) => x.id !== p.id))
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
          {t("产品管理", "Products")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t(
            "配置可售产品及其站内入口；勾选「全站通」后，该产品权益可覆盖其他产品。",
            "Configure sellable products and their site entry paths. All-access products cover other products.",
          )}
        </p>
      </div>

      <MembershipSubnav group="sales" />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/50 bg-card/50 p-5">
        <div className="space-y-1.5">
          <Label>key（英文唯一）</Label>
          <Input className="w-44" placeholder="pro-access" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        </div>
        <div className="min-w-[160px] flex-1 space-y-1.5">
          <Label>{t("名称", "Name")}</Label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("如专业会员", "e.g. Pro membership")} />
        </div>
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <Label>{t("入口路径（可选）", "Entry path (optional)")}</Label>
          <Input
            value={newLandingPath}
            onChange={(e) => setNewLandingPath(e.target.value)}
            placeholder="/zh/products/pro-access"
          />
        </div>
        <Button onClick={create} disabled={creating}>
          {creating ? t("新建中…", "Creating…") : t("新建产品", "New product")}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("加载中…", "Loading…")}</p>
      ) : forbidden ? (
        <p className="text-muted-foreground">{t("无权限（体验账户仅可浏览）", "No permission")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-5">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{p.key}</Badge>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${p.enabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {p.enabled ? t("启用", "On") : t("停用", "Off")}
                  </span>
                  <Switch checked={p.enabled} onCheckedChange={(v) => update(p.id, { enabled: v })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("名称", "Name")}</Label>
                <Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("简介", "Blurb")}</Label>
                <Input value={p.blurb ?? ""} onChange={(e) => update(p.id, { blurb: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("入口路径", "Entry path")}</Label>
                <Input
                  value={p.landingPath ?? ""}
                  onChange={(e) => update(p.id, { landingPath: e.target.value || null })}
                  placeholder="/zh/products/pro-access"
                />
                <p className="text-xs text-muted-foreground">
                  {t("站内相对路径，以 / 开头；文章产品入口和支付成功页会使用它。", "Internal path starting with /. Used by article CTAs and post-payment links.")}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <Label>{t("排序", "Sort")}</Label>
                  <Input type="number" className="w-20" value={p.sortOrder} onChange={(e) => update(p.id, { sortOrder: Number(e.target.value) })} />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <Switch checked={p.isAllAccess} onCheckedChange={(v) => update(p.id, { isAllAccess: v })} />
                  {t("全站通", "All-access")}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Button className="flex-1" onClick={() => save(p)} disabled={saving === p.id}>
                  {saving === p.id ? t("保存中…", "Saving…") : t("保存", "Save")}
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(p)}
                  disabled={saving === p.id}
                >
                  {t("删除", "Delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("确认删除产品", "Confirm Product Deletion")}
        description={
          deleteTarget
            ? t(
                `确定删除产品「${deleteTarget.name}」？不可撤销（套餐会一并删除；仍有关联订单、权益或文章入口时会被拦截）。`,
                `Delete product "${deleteTarget.name}"? This cannot be undone.`,
              )
            : ""
        }
        confirmLabel={t("确认删除", "Confirm Delete")}
        loading={!!deleteTarget && saving === deleteTarget.id}
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget)
        }}
      />
    </div>
  )
}
