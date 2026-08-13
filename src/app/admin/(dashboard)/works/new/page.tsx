"use client"
/** 新建作品：按 type 创建草稿后跳转编辑页。 */
import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

export default function NewWorkPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const isEn = locale === "en"
  const router = useRouter()
  const searchParams = useSearchParams()
  const creating = useRef(false)

  useEffect(() => {
    if (creating.current) return
    creating.current = true

    const workType = searchParams.get("type") === "development" ? "DEVELOPMENT" : "DESIGN"

    fetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: isEn ? "Untitled Work" : "无标题作品",
        slug: `draft-${Date.now()}`,
        workType,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.id) {
          router.replace(`/admin/works/${data.id}/edit`)
        } else {
          toast.error(data?.error || (isEn ? "Create failed" : "创建失败"))
          const fallback = workType === "DEVELOPMENT" ? "/admin/works/development" : "/admin/works/design"
          router.replace(fallback)
        }
      })
      .catch(() => {
        toast.error(isEn ? "Network error" : "网络错误")
        router.replace("/admin/works/design")
      })
  }, [router, searchParams, isEn])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-muted-foreground">
        <i className="ri-loader-4-line animate-spin text-lg" />
        <span className="text-sm">{t("正在创建作品…", "Creating work…")}</span>
      </div>
    </div>
  )
}
