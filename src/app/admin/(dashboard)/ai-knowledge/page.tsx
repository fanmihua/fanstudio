"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import {
  defaultAIAssistantConfig,
  normalizeAIAssistantConfig,
  type AIAssistantConfig,
  type AIAssistantManualKnowledge,
} from "@/lib/ai-assistant-config"

type KnowledgeSourceRow = {
  id: string
  sourceType: "POST" | "WORK" | "TUTORIAL" | "SETTINGS"
  sourceId: string
  title: string
  url: string
  updatedAt: string
  chunkCount: number
  chunkPreview: Array<{ chunkIndex: number; contentText: string }>
}

type KnowledgeHealth = {
  knowledge: {
    sources: number
    chunks: number
  }
}

type ManualKnowledgeRow = AIAssistantManualKnowledge

type AssistantI18nState = {
  zh: AIAssistantConfig
  en: AIAssistantConfig
}

function formatUpdatedAt(value: string, locale: "zh" | "en"): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { hour12: false })
}

function createManualKnowledgeRow(index: number): ManualKnowledgeRow {
  const now = Date.now()
  return {
    id: `manual-${now}-${index + 1}`,
    title: "",
    question: "",
    answer: "",
    keywords: [],
    sourceUrls: [],
    enabled: true,
    showAsQuickQuestion: true,
    sortOrder: index,
  }
}

function parseCommaList(text: string): string[] {
  return text
    .split(/,|，/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function escapeCsvCell(value: string): string {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`
  return text
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\""
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

function parseCsvRows(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine)
}

function toBool(value: string, fallback: boolean): boolean {
  const text = (value || "").trim().toLowerCase()
  if (!text) return fallback
  if (["1", "true", "yes", "y", "是", "启用"].includes(text)) return true
  if (["0", "false", "no", "n", "否", "禁用"].includes(text)) return false
  return fallback
}

function normalizeAssistantI18n(rawI18n: unknown, fallback: unknown): AssistantI18nState {
  const fallbackConfig = normalizeAIAssistantConfig(fallback)
  const obj = rawI18n && typeof rawI18n === "object" ? (rawI18n as Record<string, unknown>) : null
  return {
    zh: normalizeAIAssistantConfig(obj?.zh ?? fallbackConfig),
    en: normalizeAIAssistantConfig(obj?.en ?? fallbackConfig),
  }
}

export default function AdminAIKnowledgePage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState(false)
  const [savingManual, setSavingManual] = useState(false)
  const [rows, setRows] = useState<KnowledgeSourceRow[]>([])
  const [health, setHealth] = useState<KnowledgeHealth | null>(null)
  const [assistantConfig, setAssistantConfig] = useState<AIAssistantConfig>(defaultAIAssistantConfig)
  const [assistantI18n, setAssistantI18n] = useState<AssistantI18nState>({
    zh: defaultAIAssistantConfig,
    en: defaultAIAssistantConfig,
  })
  const [copyLocale, setCopyLocale] = useState<"zh" | "en">(locale === "en" ? "en" : "zh")
  const [manualRows, setManualRows] = useState<ManualKnowledgeRow[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<ManualKnowledgeRow | null>(null)
  const [chunkPreviewRow, setChunkPreviewRow] = useState<KnowledgeSourceRow | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sourcesRes, healthRes, settingsRes] = await Promise.all([
        fetch("/api/ai/knowledge-sources?take=200", { credentials: "include" }),
        fetch("/api/ai/health", { credentials: "include" }),
        fetch("/api/settings", { credentials: "include" }),
      ])

      const sourcesData = await sourcesRes.json().catch(() => ({}))
      const healthData = await healthRes.json().catch(() => ({}))
      const settingsData = await settingsRes.json().catch(() => ({}))

      if (!sourcesRes.ok) {
        throw new Error((sourcesData?.detail as string) || (sourcesData?.error as string) || t("加载知识来源失败", "Failed to load knowledge sources"))
      }
      if (!healthRes.ok) {
        throw new Error((healthData?.detail as string) || (healthData?.error as string) || t("加载状态失败", "Failed to load status"))
      }
      if (!settingsRes.ok) {
        throw new Error((settingsData?.detail as string) || (settingsData?.error as string) || t("加载 AI 配置失败", "Failed to load AI config"))
      }

      const normalized = normalizeAIAssistantConfig(settingsData?.aiAssistant)
      const localized = normalizeAssistantI18n(settingsData?.aiAssistantI18n, settingsData?.aiAssistant)
      const sortedManual = [...normalized.manualKnowledge].sort((a, b) => a.sortOrder - b.sortOrder)

      setRows(Array.isArray(sourcesData?.rows) ? (sourcesData.rows as KnowledgeSourceRow[]) : [])
      setHealth(healthData as KnowledgeHealth)
      setAssistantConfig(normalized)
      setAssistantI18n(localized)
      setManualRows(sortedManual)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("加载知识库失败", "Failed to load knowledge base"))
      setRows([])
      setHealth(null)
      setAssistantConfig(defaultAIAssistantConfig)
      setAssistantI18n({
        zh: defaultAIAssistantConfig,
        en: defaultAIAssistantConfig,
      })
      setManualRows([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    setCopyLocale(locale === "en" ? "en" : "zh")
  }, [locale])

  useEffect(() => {
    const nextManual = [...assistantI18n[copyLocale].manualKnowledge].sort((a, b) => a.sortOrder - b.sortOrder)
    setManualRows(nextManual)
  }, [assistantI18n, copyLocale])

  function syncManualRows(nextRows: ManualKnowledgeRow[]) {
    const normalizedRows = nextRows.map((item, index) => ({ ...item, sortOrder: index }))
    setManualRows(normalizedRows)
    setAssistantI18n((prev) => ({
      ...prev,
      [copyLocale]: {
        ...prev[copyLocale],
        manualKnowledge: normalizedRows,
      },
    }))
  }

  function openCreateDialog() {
    setEditingIndex(null)
    setDraft(createManualKnowledgeRow(manualRows.length))
    setDialogOpen(true)
  }

  function openEditDialog(index: number) {
    const row = manualRows[index]
    if (!row) return
    setEditingIndex(index)
    setDraft({ ...row })
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingIndex(null)
      setDraft(null)
    }
  }

  function applyDraft() {
    if (!draft) return
    const next: ManualKnowledgeRow = {
      ...draft,
      id: draft.id.trim() || createManualKnowledgeRow(manualRows.length).id,
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      title: draft.question.trim(),
      sourceUrls: [],
      keywords: draft.keywords,
    }

    if (!next.question || !next.answer) {
      toast.error(t("问题和答案为必填项", "Question and answer are required"))
      return
    }

    if (editingIndex == null) {
      syncManualRows([...manualRows, { ...next, sortOrder: manualRows.length }])
    } else {
      const cloned = [...manualRows]
      if (!cloned[editingIndex]) return
      cloned[editingIndex] = { ...next, sortOrder: editingIndex }
      syncManualRows(cloned)
    }

    handleDialogOpenChange(false)
  }

  function removeManualRow(index: number) {
    syncManualRows(manualRows.filter((_, i) => i !== index))
  }

  async function handleSaveManualKnowledge() {
    setSavingManual(true)
    try {
      const buildManualPayload = (rows: ManualKnowledgeRow[]) =>
        rows
        .map((item, index) => ({
          id: item.id.trim(),
          question: item.question.trim(),
          answer: item.answer.trim(),
          title: item.question.trim(),
          keywords: item.keywords,
          sourceUrls: [],
          enabled: !!item.enabled,
          showAsQuickQuestion: !!item.showAsQuickQuestion,
          sortOrder: index,
        }))
        .filter((item) => item.question && item.answer)

      const zhManual = buildManualPayload(assistantI18n.zh.manualKnowledge)
      const enManual = buildManualPayload(assistantI18n.en.manualKnowledge)

      const payload = normalizeAIAssistantConfig({
        ...assistantConfig,
        manualKnowledge: zhManual,
      })
      const payloadI18n: AssistantI18nState = {
        zh: normalizeAIAssistantConfig({
          ...assistantI18n.zh,
          retrievalSources: payload.retrievalSources,
          manualKnowledgeMode: payload.manualKnowledgeMode,
          manualKnowledge: zhManual,
        }),
        en: normalizeAIAssistantConfig({
          ...assistantI18n.en,
          retrievalSources: payload.retrievalSources,
          manualKnowledgeMode: payload.manualKnowledgeMode,
          manualKnowledge: enManual,
        }),
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ aiAssistant: payload, aiAssistantI18n: payloadI18n }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data?.detail as string) || (data?.error as string) || t("保存失败", "Save failed"))
      }

      const normalized = normalizeAIAssistantConfig(data?.aiAssistant)
      const localized = normalizeAssistantI18n(data?.aiAssistantI18n, data?.aiAssistant)
      setAssistantConfig(normalized)
      setAssistantI18n(localized)
      toast.success(t("人工知识库已保存", "Manual knowledge saved"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("保存失败", "Save failed"))
    } finally {
      setSavingManual(false)
    }
  }

  async function handleRebuild() {
    setRebuilding(true)
    try {
      const res = await fetch("/api/ai/rebuild", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data?.detail as string) || (data?.error as string) || t("重建失败", "Rebuild failed"))
      }
      toast.success(t("知识库重建完成", "Knowledge rebuild completed"))
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("知识库重建失败", "Knowledge rebuild failed"))
    } finally {
      setRebuilding(false)
    }
  }

  function handleDownloadTemplate() {
    const headers = [
      t("问题", "Question"),
      t("答案", "Answer"),
      t("关键词(逗号分隔)", "Keywords(comma separated)"),
      t("启用(true/false)", "Enabled(true/false)"),
      t("用于引导(true/false)", "QuickQuestion(true/false)"),
    ]
    const example = [
      t("如何联系你合作？", "How can I contact you for collaboration?"),
      t("可以通过邮箱或社媒联系我，说明项目背景与预期时间。", "You can contact me via email or social media with project context and timeline."),
      t("合作, 联系, 邮箱, 流程", "collaboration, contact, email, process"),
      "true",
      "true",
    ]
    const csv = `\uFEFF${headers.map(escapeCsvCell).join(",")}\n${example.map(escapeCsvCell).join(",")}\n`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "ai-knowledge-template.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportKnowledgeFile(file: File) {
    if (!/\.csv$/i.test(file.name)) {
      toast.error(t("请导入 CSV 文件（Excel 可直接打开和另存为 CSV）", "Please import a CSV file"))
      return
    }
    const text = await file.text()
    const rowsData = parseCsvRows(text)
    if (rowsData.length <= 1) {
      toast.error(t("导入文件没有有效数据", "No valid data found in imported file"))
      return
    }
    const startIndex = rowsData[0][0]?.includes(t("问题", "Question")) ? 1 : 0
    const header = rowsData[0] || []
    const hasLegacySourceColumns =
      header.some((cell) => cell.includes(t("来源链接", "Source URL")))
    const imported: ManualKnowledgeRow[] = []
    for (let i = startIndex; i < rowsData.length; i += 1) {
      const row = rowsData[i]
      const question = (row[0] || "").trim()
      const answer = (row[1] || "").trim()
      if (!question || !answer) continue
      const keywords = parseCommaList(row[2] || "")
      const enabled = toBool(row[hasLegacySourceColumns ? 5 : 3] || "", true)
      const showAsQuickQuestion = toBool(row[hasLegacySourceColumns ? 6 : 4] || "", true)
      imported.push({
        id: `import-${Date.now()}-${i}`,
        title: question,
        question,
        answer,
        keywords,
        sourceUrls: [],
        enabled,
        showAsQuickQuestion,
        sortOrder: imported.length,
      })
    }

    if (imported.length === 0) {
      toast.error(t("未识别到有效条目，请检查“问题、答案”是否填写", "No valid rows detected. Please fill Question and Answer."))
      return
    }

    syncManualRows([...manualRows, ...imported])
    toast.success(t(`已导入 ${imported.length} 条知识，记得点击“保存人工知识库”`, `Imported ${imported.length} rows. Remember to save manual knowledge.`))
  }

  const summary = useMemo(() => {
    if (!health) return t("暂无数据", "No data")
    return t(
      `来源 ${health.knowledge.sources} · 切片 ${health.knowledge.chunks}`,
      `Sources ${health.knowledge.sources} · Chunks ${health.knowledge.chunks}`,
    )
  }, [health, t])

  const quickQuestionPreview = manualRows
    .filter((item) => item.enabled && item.showAsQuickQuestion)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 6)
    .map((item) => item.question)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t("知识库", "Knowledge Base")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("人工配置知识和自动索引明细统一管理。", "Manage manual knowledge and auto-index details in one place.")}</p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("人工知识库（含引导问题来源）", "Manual Knowledge (including quick questions)")}</CardTitle>
          <CardDescription>{t("新增和编辑使用表单弹窗，表格仅用于浏览与管理。", "Use form dialogs to create/edit; table is for browsing and management.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="inline-flex items-center rounded-lg border border-border/70 p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs ${copyLocale === "zh" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCopyLocale("zh")}
            >
              中文
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs ${copyLocale === "en" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setCopyLocale("en")}
            >
              English
            </button>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">{t("检索模块（决定主回答会检索哪些内容）", "Retrieval sources (determine what main answer searches)")}</p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-black"
                  checked={assistantConfig.retrievalSources.posts}
                  onChange={(e) =>
                    setAssistantConfig((prev) => ({
                      ...prev,
                      retrievalSources: { ...prev.retrievalSources, posts: e.target.checked },
                    }))
                  }
                />
                {t("文章", "Posts")}
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-black"
                  checked={assistantConfig.retrievalSources.works}
                  onChange={(e) =>
                    setAssistantConfig((prev) => ({
                      ...prev,
                      retrievalSources: { ...prev.retrievalSources, works: e.target.checked },
                    }))
                  }
                />
                {t("作品", "Works")}
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-black"
                  checked={assistantConfig.retrievalSources.tutorials}
                  onChange={(e) =>
                    setAssistantConfig((prev) => ({
                      ...prev,
                      retrievalSources: { ...prev.retrievalSources, tutorials: e.target.checked },
                    }))
                  }
                />
                {t("教程", "Tutorials")}
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-black"
                  checked={assistantConfig.retrievalSources.about}
                  onChange={(e) =>
                    setAssistantConfig((prev) => ({
                      ...prev,
                      retrievalSources: { ...prev.retrievalSources, about: e.target.checked },
                    }))
                  }
                />
                {t("关于我", "About")}
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-black"
                  checked={assistantConfig.retrievalSources.manualKnowledge}
                  onChange={(e) =>
                    setAssistantConfig((prev) => ({
                      ...prev,
                      retrievalSources: { ...prev.retrievalSources, manualKnowledge: e.target.checked },
                    }))
                  }
                />
                {t("人工知识", "Manual Knowledge")}
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {t("当前引导问题：", "Current quick questions:")}{quickQuestionPreview.length > 0 ? quickQuestionPreview.join(" · ") : t("暂无", "None")}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("人工知识用途", "Manual knowledge mode")}</span>
                <Select
                  value={assistantConfig.manualKnowledgeMode}
                  onValueChange={(value) =>
                    setAssistantConfig((prev) => ({
                      ...prev,
                      manualKnowledgeMode: value as "recommend_only" | "direct_answer" | "hybrid",
                    }))
                  }
                >
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommend_only">{t("仅推荐", "Recommend Only")}</SelectItem>
                    <SelectItem value="direct_answer">{t("可直答", "Direct Answer")}</SelectItem>
                    <SelectItem value="hybrid">{t("混合", "Hybrid")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate}>{t("下载 Excel 模版（CSV）", "Download CSV template")}</Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) await handleImportKnowledgeFile(file)
                  e.target.value = ""
                }}
              />
              <Button variant="outline" onClick={() => importInputRef.current?.click()}>{t("导入知识库（CSV）", "Import knowledge (CSV)")}</Button>
              <Button variant="outline" onClick={openCreateDialog}>{t("新增条目", "Add item")}</Button>
              <Button onClick={() => void handleSaveManualKnowledge()} disabled={savingManual || loading}>
                {savingManual ? t("保存中...", "Saving...") : t("保存人工知识库", "Save manual knowledge")}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">{t("启用", "Enabled")}</TableHead>
                  <TableHead className="w-[90px]">{t("引导", "Quick")}</TableHead>
                  <TableHead className="min-w-[220px]">{t("问题", "Question")}</TableHead>
                  <TableHead className="min-w-[280px]">{t("答案", "Answer")}</TableHead>
                  <TableHead className="min-w-[160px]">{t("关键词", "Keywords")}</TableHead>
                  <TableHead className="w-[110px]">{t("操作", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manualRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t("暂无人工知识，请点击“新增条目”", "No manual knowledge yet. Click \"Add item\".")}
                    </TableCell>
                  </TableRow>
                ) : (
                  manualRows.map((row, index) => (
                    <TableRow key={`${row.id}-${index}`}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="accent-black"
                          checked={row.enabled}
                          onChange={(e) => {
                            syncManualRows(manualRows.map((item, i) => (i === index ? { ...item, enabled: e.target.checked } : item)))
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="accent-black"
                          checked={row.showAsQuickQuestion}
                          onChange={(e) => {
                            syncManualRows(manualRows.map((item, i) => (i === index ? { ...item, showAsQuickQuestion: e.target.checked } : item)))
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.question}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <p className="line-clamp-2">{row.answer}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.keywords.join(", ") || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(index)}>
                            <i className="ri-edit-line" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-8 w-8 p-0"
                            onClick={() => removeManualRow(index)}
                          >
                            <i className="ri-delete-bin-line" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("自动索引明细", "Auto-index Details")}</CardTitle>
          <CardDescription>{loading ? t("正在加载...", "Loading...") : summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => void loadData()} disabled={loading || rebuilding}>
              {loading ? t("刷新中...", "Refreshing...") : t("刷新明细", "Refresh details")}
            </Button>
            <Button onClick={() => void handleRebuild()} disabled={rebuilding || loading}>
              {rebuilding ? t("重建中...", "Rebuilding...") : t("重建知识库", "Rebuild knowledge")}
            </Button>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">{t("类型", "Type")}</TableHead>
                  <TableHead className="min-w-[220px]">{t("标题", "Title")}</TableHead>
                  <TableHead className="w-[140px]">{t("切片预览", "Chunk Preview")}</TableHead>
                  <TableHead className="w-[180px]">{t("更新时间", "Updated At")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {loading ? t("正在加载知识来源...", "Loading sources...") : t("暂无知识来源", "No sources")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.sourceType}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <a href={row.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                            {row.title}
                          </a>
                          <p className="text-xs text-muted-foreground break-all">{row.url}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.chunkPreview.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setChunkPreviewRow(row)}
                          >
                            {t("查看", "View")}（{row.chunkPreview.length}）
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatUpdatedAt(row.updatedAt, locale)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingIndex == null ? t("新增知识条目", "New Knowledge Item") : t("编辑知识条目", "Edit Knowledge Item")}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("问题（必填）", "Question (required)")}</p>
                <Input value={draft.question} onChange={(e) => setDraft((prev) => (prev ? { ...prev, question: e.target.value } : prev))} placeholder={t("例如：如何联系你合作？", "e.g. How can I contact you for collaboration?")} />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t("答案（必填）", "Answer (required)")}</p>
                <Textarea rows={4} value={draft.answer} onChange={(e) => setDraft((prev) => (prev ? { ...prev, answer: e.target.value } : prev))} placeholder={t("填写标准答案", "Enter standard answer")} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t("关键词（逗号分隔）", "Keywords (comma separated)")}</p>
                  <Input
                    value={draft.keywords.join(", ")}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, keywords: parseCommaList(e.target.value) } : prev))}
                    placeholder={t("合作, 报价, 流程", "collaboration, quote, process")}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-black"
                    checked={draft.enabled}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))}
                  />
                  {t("启用", "Enabled")}
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-black"
                    checked={draft.showAsQuickQuestion}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, showAsQuickQuestion: e.target.checked } : prev))}
                  />
                  {t("用于引导问题", "Use as quick question")}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
                  {t("取消", "Cancel")}
                </Button>
                <Button onClick={applyDraft}>{t("确定", "Confirm")}</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!chunkPreviewRow} onOpenChange={(open) => !open && setChunkPreviewRow(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("切片预览", "Chunk Preview")}</DialogTitle>
          </DialogHeader>
          {chunkPreviewRow ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/70 bg-card/50 px-3 py-2">
                <p className="text-sm font-medium">{chunkPreviewRow.title}</p>
                <a
                  href={chunkPreviewRow.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground break-all hover:underline"
                >
                  {chunkPreviewRow.url}
                </a>
              </div>
              <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
                {chunkPreviewRow.chunkPreview.length > 0 ? (
                  chunkPreviewRow.chunkPreview.map((chunk) => (
                    <div key={`${chunkPreviewRow.id}-${chunk.chunkIndex}`} className="rounded border border-border px-3 py-2 bg-background">
                      <p className="text-[10px] text-muted-foreground mb-1">{t("切片", "Chunk")} #{chunk.chunkIndex}</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{chunk.contentText}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t("暂无切片预览。", "No chunk preview.")}</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
