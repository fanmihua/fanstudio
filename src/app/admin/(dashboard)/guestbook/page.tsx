"use client"
/** 后台「来坐坐」留言管理：列表 + 隐藏/显示 + 删除（主楼级联删回复）。 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type Row = {
  id: string
  nickname: string | null
  content: string
  hidden: boolean
  pinned: boolean
  isOwner: boolean
  parentId: string | null
  parent: { id: string; nickname: string | null } | null
  createdAt: string
}

export default function AdminGuestbookPage() {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)
  const [nameZh, setNameZh] = useState("")
  const [nameEn, setNameEn] = useState("")
  const [showModule, setShowModule] = useState(true)
  const [greetingZh, setGreetingZh] = useState("")
  const [greetingEn, setGreetingEn] = useState("")
  const [savingGreeting, setSavingGreeting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/guestbook?admin=1", { credentials: "include", cache: "no-store" })
      if (!res.ok) {
        toast.error(locale === "en" ? "Failed to load" : "加载失败")
        return
      }
      const data = await res.json()
      setRows(Array.isArray(data.messages) ? data.messages : [])
    } catch {
      toast.error(locale === "en" ? "Failed to load" : "加载失败")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadGreeting = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { credentials: "include", cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      const pc = data.pageCopy || {}
      setNameZh(pc.guestbookName ?? "")
      setNameEn(pc.guestbookNameEn ?? "")
      setShowModule(pc.showGuestbook !== false)
      setGreetingZh(pc.guestbookGreeting ?? "")
      setGreetingEn(pc.guestbookGreetingEn ?? "")
    } catch {
      /* ignore */
    }
  }, [])

  async function saveGreeting() {
    setSavingGreeting(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pageCopy: {
            guestbookName: nameZh.trim(),
            guestbookNameEn: nameEn.trim(),
            showGuestbook: showModule,
            guestbookGreeting: greetingZh.trim(),
            guestbookGreetingEn: greetingEn.trim(),
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || t("保存失败", "Save failed"))
        return
      }
      toast.success(t("寄语已保存", "Greeting saved"))
    } finally {
      setSavingGreeting(false)
    }
  }

  useEffect(() => {
    load()
    loadGreeting()
  }, [load, loadGreeting])

  async function toggleHidden(row: Row) {
    setBusy(true)
    try {
      const res = await fetch(`/api/guestbook/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hidden: !row.hidden }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || t("操作失败", "Failed"))
        return
      }
      toast.success(row.hidden ? t("已显示", "Shown") : t("已隐藏", "Hidden"))
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function togglePinned(row: Row) {
    setBusy(true)
    try {
      const res = await fetch(`/api/guestbook/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pinned: !row.pinned }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || t("操作失败", "Failed"))
        return
      }
      toast.success(row.pinned ? t("已取消置顶", "Unpinned") : t("已置顶", "Pinned"))
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function doDelete() {
    if (!pendingDelete) return
    setBusy(true)
    try {
      const res = await fetch(`/api/guestbook/${pendingDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        toast.error(t("删除失败", "Delete failed"))
        return
      }
      toast.success(t("已删除", "Deleted"))
      setPendingDelete(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString(locale === "en" ? "en-US" : "zh-CN")
  const anon = t("匿名朋友", "A friend")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <i className="ri-cup-line" /> {t("来坐坐 · 留言管理", "Guestbook")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("访客留言即时展示；这里可以隐藏或删除。", "Visitor messages publish instantly — hide or delete them here.")}
        </p>
      </div>

      {/* 板块设置：名称 / 显隐 / 寄语 */}
      <div className="space-y-4 rounded-lg border border-border p-4 md:p-5">
        <div className="flex items-center gap-2">
          <i className="ri-settings-4-line text-foreground" />
          <h2 className="font-medium text-foreground">{t("板块设置", "Module settings")}</h2>
        </div>

        {/* 模块名称 */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("板块名称（中文）", "Name (Chinese)")}</label>
            <input
              value={nameZh}
              onChange={(e) => setNameZh(e.target.value)}
              maxLength={20}
              placeholder="来坐坐"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("板块名称（英文）", "Name (English)")}</label>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              maxLength={30}
              placeholder="Pull Up a Chair"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* 显示开关 */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={showModule}
            onChange={(e) => setShowModule(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-foreground"
          />
          {t("在左侧导航显示该模块", "Show this module in the sidebar")}
        </label>

        {/* 寄语 */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <i className="ri-chat-quote-line" />
            {t("我的寄语（显示在留言板最上方）", "Your greeting (shown atop the guestbook)")}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("中文", "Chinese")}</label>
              <textarea
                value={greetingZh}
                onChange={(e) => setGreetingZh(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t("跟来访的朋友说点什么…", "Say hi to your visitors…")}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t("英文", "English")}</label>
              <textarea
                value={greetingEn}
                onChange={(e) => setGreetingEn(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Say hi to your visitors…"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" disabled={savingGreeting} onClick={saveGreeting}>
            {savingGreeting ? t("保存中…", "Saving…") : t("保存设置", "Save")}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("加载中…", "Loading…")}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          {t("还没有留言", "No messages yet")}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[42%]">{t("留言", "Message")}</TableHead>
                <TableHead>{t("访客", "From")}</TableHead>
                <TableHead className="whitespace-nowrap">{t("时间", "Time")}</TableHead>
                <TableHead>{t("状态", "Status")}</TableHead>
                <TableHead className="text-right">{t("操作", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.hidden ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {r.parentId && (
                        <Badge variant="outline" className="shrink-0">{t("回复", "Reply")}</Badge>
                      )}
                      <span className="whitespace-pre-wrap break-words text-sm text-foreground/90 line-clamp-3">
                        {r.content}
                      </span>
                    </div>
                    {r.parent && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        ↳ {t("回复给", "to")} {r.parent.nickname || anon}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{r.nickname || anon}</span>
                    {r.isOwner && <Badge className="ml-1">{t("博主", "Author")}</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmt(r.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {r.pinned && <Badge>{t("置顶", "Pinned")}</Badge>}
                      {r.hidden ? (
                        <Badge variant="secondary">{t("已隐藏", "Hidden")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("显示中", "Visible")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {!r.parentId && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => togglePinned(r)}>
                        {r.pinned ? t("取消置顶", "Unpin") : t("置顶", "Pin")}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggleHidden(r)}>
                      {r.hidden ? t("显示", "Show") : t("隐藏", "Hide")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="text-red-500 hover:text-red-600"
                      onClick={() => setPendingDelete(r)}
                    >
                      {t("删除", "Delete")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("删除这条留言？", "Delete this message?")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              "删除后无法恢复；若是主楼，其下的回复也会一并删除。",
              "This can't be undone. Deleting a top-level message also removes its replies.",
            )}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {t("取消", "Cancel")}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={doDelete}>
              {t("删除", "Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
