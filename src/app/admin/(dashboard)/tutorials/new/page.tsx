"use client"
/** 新建教程：先 POST 创建再跳转编辑页。 */
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

export default function NewTutorialPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const isEn = locale === "en"
  const router = useRouter()
  const creating = useRef(false)

  useEffect(() => {
    if (creating.current) return
    creating.current = true

    fetch("/api/tutorials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: isEn ? "Untitled Tutorial" : "无标题教程",
        slug: `draft-${Date.now()}`,
        videoUrl: "",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.id) {
          router.replace(`/admin/tutorials/${data.id}/edit`)
        } else {
          toast.error(data?.error || (isEn ? "Create failed" : "创建失败"))
          router.replace("/admin/tutorials")
        }
      })
      .catch(() => {
        toast.error(isEn ? "Network error" : "网络错误")
        router.replace("/admin/tutorials")
      })
  }, [router, isEn])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-muted-foreground">
        <i className="ri-loader-4-line animate-spin text-lg" />
        <span className="text-sm">{t("正在创建教程…", "Creating tutorial…")}</span>
      </div>
    </div>
  )
}
