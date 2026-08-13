"use client"
/** 赠送开通：按产品给单个或批量邮箱开通会员权益。 */
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MembershipSubnav } from "@/components/admin/membership/MembershipSubnav"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface Product {
  key: string
  name: string
}

type DurationKind = "365" | "30" | "lifetime" | "custom"

export default function MembershipGrantPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [emails, setEmails] = useState("")
  const [productKey, setProductKey] = useState("")
  const [duration, setDuration] = useState<DurationKind>("365")
  const [customDays, setCustomDays] = useState("90")
  const [note, setNote] = useState("")
  const [granting, setGranting] = useState(false)
  const [lastResult, setLastResult] = useState<{ granted: number; invalid: string[] } | null>(null)

  const durationBtns: [DurationKind, string][] = [
    ["365", t("一年", "1y")],
    ["30", t("一个月", "1m")],
    ["lifetime", t("永久", "Lifetime")],
    ["custom", t("自定义", "Custom")],
  ]

  const loadProducts = useCallback(() => {
    setLoadingProducts(true)
    fetch("/api/admin/membership/products", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return []
        }
        return r.ok ? r.json() : []
      })
      .then((d) => {
        if (!Array.isArray(d)) return
        const list = d.map((p: { key: string; name: string }) => ({ key: p.key, name: p.name }))
        setProducts(list)
        setProductKey((current) => (list.some((p) => p.key === current) ? current : ""))
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadProducts, 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  function daysFromDuration(): number | null | undefined {
    if (duration === "lifetime") return null
    if (duration === "custom") {
      const n = Number(customDays)
      if (!Number.isInteger(n) || n <= 0) return undefined
      return n
    }
    return Number(duration)
  }

  async function grant() {
    if (!productKey) {
      toast.error(t("请先选择产品", "Select a product first"))
      return
    }
    const list = emails.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    if (list.length === 0) {
      toast.error(t("请输入至少一个邮箱", "Enter at least one email"))
      return
    }
    const days = daysFromDuration()
    if (days === undefined) {
      toast.error(t("自定义天数无效", "Invalid custom days"))
      return
    }
    setGranting(true)
    setLastResult(null)
    try {
      const r = await fetch("/api/admin/membership/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emails: list, productKey, days, note: note.trim() || null }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error || t("开通失败", "Failed"))
        return
      }
      const invalid = Array.isArray(d.invalid) ? d.invalid : []
      setLastResult({ granted: d.granted ?? 0, invalid })
      toast.success(
        t(`已开通 ${d.granted} 人`, `Granted ${d.granted}`) +
          (invalid.length ? t(`，${invalid.length} 个无效已跳过`, `, ${invalid.length} skipped`) : ""),
      )
      setEmails("")
      setNote("")
    } catch {
      toast.error(t("网络错误", "Network error"))
    } finally {
      setGranting(false)
    }
  }

  const selectedProduct = products.find((p) => p.key === productKey)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">
            {t("赠送开通", "Grant Access")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("为客户、合作伙伴或售后场景开通指定产品权益。", "Grant access to a specific product for customers, partners, or support cases.")}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/membership/members">{t("查看会员列表", "View members")}</Link>
        </Button>
      </div>

      <MembershipSubnav group="marketing" />

      <div className="space-y-5 rounded-2xl border border-border/50 bg-card/50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-foreground">{t("开通信息", "Grant details")}</h2>
          {selectedProduct && <Badge variant="outline">{selectedProduct.name}</Badge>}
        </div>

        {forbidden ? (
          <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            {t("无权限（体验账户仅可浏览）", "No permission")}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>{t("邮箱（一行一个 / 逗号分隔，可批量）", "Emails")}</Label>
              <Textarea
                rows={7}
                placeholder={"a@example.com\nb@example.com"}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("重复邮箱会自动去重，无效邮箱会跳过并在结果里提示。", "Duplicate emails are deduped; invalid emails are skipped.")}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[240px_minmax(260px,1fr)_minmax(180px,1fr)]">
              <div className="space-y-1.5">
                <Label>{t("产品", "Product")}</Label>
                <Select value={productKey} onValueChange={setProductKey} disabled={loadingProducts || products.length === 0}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder={loadingProducts ? t("加载中…", "Loading…") : t("选择产品", "Select product")} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("时长", "Duration")}</Label>
                <div className="flex flex-wrap gap-1">
                  {durationBtns.map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDuration(k)}
                      className={`rounded-md px-3 py-1.5 text-sm transition ${duration === k ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{duration === "custom" ? t("自定义天数", "Custom days") : t("备注", "Note")}</Label>
                {duration === "custom" ? (
                  <Input type="number" min={1} value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
                ) : (
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("可选，如开通原因", "Optional, e.g. reason")} />
                )}
              </div>
            </div>

            {duration === "custom" && (
              <div className="space-y-1.5">
                <Label>{t("备注", "Note")}</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("可选", "Optional")} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={grant} disabled={granting || loadingProducts || products.length === 0 || !productKey}>
                {granting ? t("开通中…", "Granting…") : t("确认开通", "Grant access")}
              </Button>
              {lastResult && (
                <p className="text-sm text-muted-foreground">
                  {t(`最近开通 ${lastResult.granted} 人`, `Last granted ${lastResult.granted}`)}
                  {lastResult.invalid.length ? t(`，跳过 ${lastResult.invalid.length} 个无效邮箱`, `, skipped ${lastResult.invalid.length}`) : ""}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
