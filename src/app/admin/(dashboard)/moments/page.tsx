"use client"
/** 后台「生活动态（真实版）」管理：增删改、置顶、排序、图文。存入 settings.pageCopy.lifeMoments。 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CoverImageUpload } from "@/components/admin/CoverImageUpload"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import type { LifeMoment } from "@/lib/page-copy"

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `m${Date.now()}${Math.floor(Math.random() * 1e6)}`
}

type MusicValue = { id?: string; name?: string; artist?: string; cover?: string }

/** 网易云音乐字段：粘贴分享链接/歌曲链接 → 服务端解析出歌曲 id/歌名/歌手/封面。 */
function MusicField({
  value,
  onChange,
  t,
}: {
  value?: MusicValue
  onChange: (music: { id: string; name?: string; artist?: string; cover?: string } | undefined) => void
  t: (zh: string, en: string) => string
}) {
  const [raw, setRaw] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function resolve() {
    const input = raw.trim()
    if (!input) return
    setErr("")
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/netease-resolve?u=${encodeURIComponent(input)}`, { credentials: "include" })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.id) {
        onChange({ id: String(d.id), name: d.name || undefined, artist: d.artist || undefined, cover: d.cover || undefined })
        setRaw("")
      } else {
        setErr(d.error || t("没识别到歌曲", "Couldn't find a song"))
      }
    } catch {
      setErr(t("解析失败，请重试", "Failed, please retry"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">
        {t("网易云音乐（可选，卡片里显示「去听」音乐卡）", "NetEase Music (optional)")}
      </label>
      {value?.id ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2">
          {value.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.cover} alt="" className="h-9 w-9 flex-shrink-0 rounded object-cover" />
          ) : (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-muted">
              <i className="ri-music-2-line" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-foreground">{value.name || `#${value.id}`}</div>
            {value.artist && <div className="truncate text-xs text-muted-foreground">{value.artist}</div>}
          </div>
          <button type="button" onClick={() => onChange(undefined)} className="flex-shrink-0 text-xs text-red-500">
            {t("移除", "Remove")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={t("粘贴网易云分享链接 / 歌曲链接", "Paste a NetEase share link")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="button" size="sm" variant="outline" disabled={busy || !raw.trim()} onClick={resolve}>
            {busy ? t("识别中…", "…") : t("识别", "Add")}
          </Button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  )
}

export default function AdminMomentsPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)

  const [moments, setMoments] = useState<LifeMoment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { credentials: "include", cache: "no-store" })
      const data = await res.json()
      const lm = data?.pageCopy?.lifeMoments
      setMoments(Array.isArray(lm) ? lm : [])
    } catch {
      toast.error(locale === "en" ? "Failed to load" : "加载失败")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function update(id: string, patch: Partial<LifeMoment>) {
    setMoments((arr) => arr.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }
  function remove(id: string) {
    setMoments((arr) => arr.filter((m) => m.id !== id))
  }
  function move(id: string, dir: -1 | 1) {
    setMoments((arr) => {
      const i = arr.findIndex((m) => m.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= arr.length) return arr
      const copy = [...arr]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }
  function add() {
    setMoments((arr) => [...arr, { id: newId(), image: "", textZh: "", textEn: "", pinned: false }])
  }

  async function save() {
    setSaving(true)
    try {
      const clean = moments
        .map((m) => ({
          id: m.id,
          image: m.image?.trim() || undefined,
          textZh: m.textZh?.trim() || undefined,
          textEn: m.textEn?.trim() || undefined,
          pinned: !!m.pinned,
          musicId: m.musicId?.trim() || undefined,
          musicName: m.musicName?.trim() || undefined,
          musicArtist: m.musicArtist?.trim() || undefined,
          musicCover: m.musicCover?.trim() || undefined,
        }))
        .filter((m) => m.image || m.textZh || m.textEn || m.musicId)
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pageCopy: { lifeMoments: clean } }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || t("保存失败", "Save failed"))
        return
      }
      toast.success(t("已保存", "Saved"))
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <i className="ri-camera-line" /> {t("生活动态（真实版）", "Life Moments")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "关于页「真实版」展示的图文动态——可加照片或纯文字、置顶、排序。改完记得点保存。",
              "Shown on the About page's “Real Me” tab — add photos or text, pin, reorder. Remember to save.",
            )}
          </p>
        </div>
        <Button size="sm" onClick={save} disabled={saving || loading}>
          {saving ? t("保存中…", "Saving…") : t("保存", "Save")}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("加载中…", "Loading…")}</p>
      ) : (
        <div className="space-y-4">
          {moments.length === 0 && (
            <div className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
              {t("还没有动态，点下面「添加一条」开始", "Nothing yet — add your first below")}
            </div>
          )}

          {moments.map((m, i) => (
            <div key={m.id} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  #{i + 1}
                  {m.pinned && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                      {t("置顶", "Pinned")}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(m.id, -1)} aria-label={t("上移", "Move up")}>
                    <i className="ri-arrow-up-line" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={i === moments.length - 1} onClick={() => move(m.id, 1)} aria-label={t("下移", "Move down")}>
                    <i className="ri-arrow-down-line" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => remove(m.id)}>
                    {t("删除", "Delete")}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{t("照片（可选）", "Photo (optional)")}</label>
                  <CoverImageUpload
                    value={m.image || ""}
                    onChange={(url) => update(m.id, { image: url })}
                    entityType="ABOUT"
                    entityId="moments"
                    aspectRatio="4/3"
                    recommendText={t("生活照，横图竖图都行", "A casual photo, any ratio")}
                  />
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">{t("配文 / 正文（中文）", "Text (Chinese)")}</label>
                    <textarea
                      value={m.textZh || ""}
                      onChange={(e) => update(m.id, { textZh: e.target.value })}
                      rows={3}
                      maxLength={500}
                      placeholder={t("照片的配文，或一条纯文字动态…", "A caption, or a text-only moment…")}
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">{t("配文 / 正文（英文）", "Text (English)")}</label>
                    <textarea
                      value={m.textEn || ""}
                      onChange={(e) => update(m.id, { textEn: e.target.value })}
                      rows={3}
                      maxLength={500}
                      placeholder="A caption, or a text-only moment…"
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <MusicField
                    value={{ id: m.musicId, name: m.musicName, artist: m.musicArtist, cover: m.musicCover }}
                    onChange={(music) =>
                      update(m.id, {
                        musicId: music?.id,
                        musicName: music?.name,
                        musicArtist: music?.artist,
                        musicCover: music?.cover,
                      })
                    }
                    t={t}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={!!m.pinned}
                      onChange={(e) => update(m.id, { pinned: e.target.checked })}
                      className="h-4 w-4 rounded border-border accent-foreground"
                    />
                    {t("置顶（排在最前）", "Pin to top")}
                  </label>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={add}>
              <i className="ri-add-line mr-1" />
              {t("添加一条", "Add a moment")}
            </Button>
            {moments.length > 0 && (
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? t("保存中…", "Saving…") : t("保存", "Save")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
