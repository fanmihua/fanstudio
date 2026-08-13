"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"
import {
  defaultAIAssistantConfig,
  normalizeAIAssistantConfig,
  type AIAssistantConfig,
} from "@/lib/ai-assistant-config"

type AIHealth = {
  configured: boolean
  provider: string
  chatModel: string
  embeddingModel: string
  baseUrl: string
  modelId?: string
  modelLabel?: string
  hasApiKey: boolean
  dbReady: boolean
  knowledge: {
    sources: number
    chunks: number
  }
}

type AdminModelOption = {
  id: string
  label: string
  chatModel: string
  enabled: boolean
}

type AdminModelConfigState = {
  enabled: boolean
  provider: "openai"
  baseUrl: string
  apiKey: string
  apiKeyMasked: string
  hasApiKey: boolean
  embeddingModel: string
  defaultModelId: string
  allowVisitorModelSwitch: boolean
  models: AdminModelOption[]
}

type AssistantI18nState = {
  zh: AIAssistantConfig
  en: AIAssistantConfig
}

function defaultModelConfigState(): AdminModelConfigState {
  return {
    enabled: false,
    provider: "openai",
    baseUrl: "",
    apiKey: "",
    apiKeyMasked: "",
    hasApiKey: false,
    embeddingModel: "text-embedding-3-small",
    defaultModelId: "default",
    allowVisitorModelSwitch: false,
    models: [{ id: "default", label: "Default Model", chatModel: "gpt-4.1-mini", enabled: true }],
  }
}

function normalizeAssistantI18n(rawI18n: unknown, fallback: unknown): AssistantI18nState {
  const fallbackConfig = normalizeAIAssistantConfig(fallback)
  const obj = rawI18n && typeof rawI18n === "object" ? (rawI18n as Record<string, unknown>) : null
  return {
    zh: normalizeAIAssistantConfig(obj?.zh ?? fallbackConfig),
    en: normalizeAIAssistantConfig(obj?.en ?? fallbackConfig),
  }
}

function StatusBadge({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <Badge variant={ok ? "default" : "outline"} className={ok ? "" : "text-muted-foreground"}>
      {ok ? okText : badText}
    </Badge>
  )
}

export default function AdminAIPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])
  const [loading, setLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingModelConfig, setSavingModelConfig] = useState(false)
  const [health, setHealth] = useState<AIHealth | null>(null)
  const [modelConfig, setModelConfig] = useState<AdminModelConfigState>(defaultModelConfigState)
  const [assistantI18n, setAssistantI18n] = useState<AssistantI18nState>({
    zh: defaultAIAssistantConfig,
    en: defaultAIAssistantConfig,
  })
  const [copyLocale, setCopyLocale] = useState<"zh" | "en">(locale === "en" ? "en" : "zh")
  const assistantConfig = assistantI18n[copyLocale]

  const loadHealth = useCallback(async () => {
    setLoading(true)
    try {
      const [healthRes, settingsRes, modelRes] = await Promise.all([
        fetch("/api/ai/health", { credentials: "include" }),
        fetch("/api/settings", { credentials: "include" }),
        fetch("/api/ai/admin-config", { credentials: "include" }),
      ])
      const healthData = await healthRes.json().catch(() => ({}))
      const settingsData = await settingsRes.json().catch(() => ({}))
      const modelData = await modelRes.json().catch(() => ({}))

      if (!healthRes.ok) throw new Error(healthData?.detail || healthData?.error || t("加载失败", "Load failed"))
      setHealth(healthData as AIHealth)
      const nextI18n = normalizeAssistantI18n(settingsData?.aiAssistantI18n, settingsData?.aiAssistant)
      setAssistantI18n(nextI18n)
      if (!modelRes.ok) throw new Error(modelData?.detail || modelData?.error || t("加载模型配置失败", "Failed to load model config"))
      setModelConfig({
        enabled: Boolean(modelData?.enabled),
        provider: modelData?.provider === "openai" ? "openai" : "openai",
        baseUrl: typeof modelData?.baseUrl === "string" ? modelData.baseUrl : "",
        apiKey: "",
        apiKeyMasked: typeof modelData?.apiKeyMasked === "string" ? modelData.apiKeyMasked : "",
        hasApiKey: Boolean(modelData?.hasApiKey),
        embeddingModel: typeof modelData?.embeddingModel === "string" ? modelData.embeddingModel : "text-embedding-3-small",
        defaultModelId: typeof modelData?.defaultModelId === "string" ? modelData.defaultModelId : "default",
        allowVisitorModelSwitch: Boolean(modelData?.allowVisitorModelSwitch),
        models: Array.isArray(modelData?.models)
          ? (modelData.models as Array<Record<string, unknown>>)
              .map((item, index) => ({
                id: typeof item.id === "string" && item.id ? item.id : `model-${index + 1}`,
                label: typeof item.label === "string" && item.label ? item.label : t("模型", "Model"),
                chatModel: typeof item.chatModel === "string" ? item.chatModel : "",
                enabled: typeof item.enabled === "boolean" ? item.enabled : true,
              }))
              .filter((item) => item.chatModel)
          : defaultModelConfigState().models,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("加载 AI 状态失败", "Failed to load AI status"))
      setHealth(null)
      setAssistantI18n({
        zh: defaultAIAssistantConfig,
        en: defaultAIAssistantConfig,
      })
      setModelConfig(defaultModelConfigState())
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    setCopyLocale(locale === "en" ? "en" : "zh")
  }, [locale])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  async function handleSaveConfig() {
    setSavingConfig(true)
    try {
      const payloadI18n: AssistantI18nState = {
        zh: normalizeAIAssistantConfig(assistantI18n.zh),
        en: normalizeAIAssistantConfig(assistantI18n.en),
      }
      const payload = payloadI18n[copyLocale]
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          locale: copyLocale,
          aiAssistant: payload,
          aiAssistantI18n: payloadI18n,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data?.detail as string) || (data?.error as string) || t("保存失败", "Save failed"))
      }
      const nextI18n = normalizeAssistantI18n(data?.aiAssistantI18n, data?.aiAssistant)
      setAssistantI18n(nextI18n)
      toast.success(t("AI 助手文案已保存", "AI assistant copy saved"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("保存失败", "Save failed"))
    } finally {
      setSavingConfig(false)
    }
  }

  function updateModelItem(index: number, patch: Partial<AdminModelOption>) {
    setModelConfig((prev) => {
      const next = [...prev.models]
      if (!next[index]) return prev
      next[index] = { ...next[index], ...patch }
      return { ...prev, models: next.slice(0, 10) }
    })
  }

  function addModelItem() {
    setModelConfig((prev) => {
      if (prev.models.length >= 10) return prev
      const n = prev.models.length + 1
      return {
        ...prev,
        models: [...prev.models, { id: `model-${n}`, label: `${t("模型", "Model")} ${n}`, chatModel: "", enabled: true }],
      }
    })
  }

  function removeModelItem(index: number) {
    setModelConfig((prev) => {
      const next = prev.models.filter((_, i) => i !== index)
      const fallbackDefault = next[0]?.id || "default"
      return {
        ...prev,
        models: next,
        defaultModelId: next.some((item) => item.id === prev.defaultModelId) ? prev.defaultModelId : fallbackDefault,
      }
    })
  }

  async function handleSaveModelConfig() {
    setSavingModelConfig(true)
    try {
      const models = modelConfig.models
        .map((item, index) => ({
          id: item.id.trim() || `model-${index + 1}`,
          label: item.label.trim() || item.chatModel.trim(),
          chatModel: item.chatModel.trim(),
          enabled: !!item.enabled,
        }))
        .filter((item) => item.chatModel)
      if (models.length === 0) {
        throw new Error(t("至少保留一个可用模型", "Keep at least one available model"))
      }
      const enabledModels = models.filter((item) => item.enabled)
      if (enabledModels.length === 0) {
        throw new Error(t("至少启用一个模型", "Enable at least one model"))
      }

      const payload = {
        enabled: modelConfig.enabled,
        provider: "openai",
        baseUrl: modelConfig.baseUrl.trim(),
        apiKey: modelConfig.apiKey.trim(),
        embeddingModel: modelConfig.embeddingModel.trim(),
        defaultModelId: modelConfig.defaultModelId,
        allowVisitorModelSwitch: modelConfig.allowVisitorModelSwitch,
        models,
      }

      const res = await fetch("/api/ai/admin-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data?.detail as string) || (data?.error as string) || t("保存失败", "Save failed"))
      }
      setModelConfig({
        enabled: Boolean(data?.enabled),
        provider: data?.provider === "openai" ? "openai" : "openai",
        baseUrl: typeof data?.baseUrl === "string" ? data.baseUrl : "",
        apiKey: "",
        apiKeyMasked: typeof data?.apiKeyMasked === "string" ? data.apiKeyMasked : "",
        hasApiKey: Boolean(data?.hasApiKey),
        embeddingModel: typeof data?.embeddingModel === "string" ? data.embeddingModel : "text-embedding-3-small",
        defaultModelId: typeof data?.defaultModelId === "string" ? data.defaultModelId : models[0].id,
        allowVisitorModelSwitch: Boolean(data?.allowVisitorModelSwitch),
        models: Array.isArray(data?.models) ? (data.models as AdminModelOption[]) : models,
      })
      toast.success(t("模型配置已保存", "Model config saved"))
      await loadHealth()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("模型配置保存失败", "Failed to save model config"))
    } finally {
      setSavingModelConfig(false)
    }
  }

  const summary = useMemo(() => {
    if (!health) return t("暂无数据", "No data")
    return t(
      `来源 ${health.knowledge.sources} · 切片 ${health.knowledge.chunks}`,
      `Sources ${health.knowledge.sources} · Chunks ${health.knowledge.chunks}`,
    )
  }, [health, t])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t("AI 助手", "AI Assistant")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("管理 AI 运行状态和前台助手文案配置。", "Manage AI runtime status and frontend assistant copy.")}</p>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("前台显示开关", "Frontend Visibility")}</CardTitle>
          <CardDescription>{t("控制前台是否展示 AI 助手入口与对话面板。", "Control whether the frontend shows AI assistant entry and chat panel.")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              id="ai-visible"
              type="checkbox"
              className="accent-black"
              checked={assistantI18n.zh.enabled}
              onChange={(e) =>
                setAssistantI18n((prev) => ({
                  zh: { ...prev.zh, enabled: e.target.checked },
                  en: { ...prev.en, enabled: e.target.checked },
                }))
              }
            />
            {t("启用后前台显示 AI 助手", "Show AI assistant on frontend when enabled")}
          </label>
          <Button onClick={() => void handleSaveConfig()} disabled={savingConfig || loading}>
            {savingConfig ? t("保存中...", "Saving...") : t("保存显示状态", "Save visibility")}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="assistant" className="space-y-6">
        <TabsList>
          <TabsTrigger value="assistant">{t("助手文案", "Assistant Copy")}</TabsTrigger>
          <TabsTrigger value="system">{t("系统状态", "System Status")}</TabsTrigger>
          <TabsTrigger value="models">{t("模型配置", "Model Config")}</TabsTrigger>
        </TabsList>

        <TabsContent value="assistant">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{t("助手文案配置", "Assistant Copy Config")}</CardTitle>
              <CardDescription>{t("这里修改前台 AI 助手的标题、欢迎语和输入相关文案。", "Edit assistant title, welcome text and input related copy.")}</CardDescription>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ai-launcher-label">{t("浮窗按钮文案", "Launcher Label")}</Label>
                  <Input
                    id="ai-launcher-label"
                    value={assistantConfig.launcherLabel}
                    onChange={(e) =>
                      setAssistantI18n((prev) => ({
                        ...prev,
                        [copyLocale]: { ...prev[copyLocale], launcherLabel: e.target.value },
                      }))
                    }
                    placeholder={t("AI 助手", "AI Assistant")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-title">{t("助手标题", "Assistant Title")}</Label>
                  <Input
                    id="ai-title"
                    value={assistantConfig.title}
                    onChange={(e) =>
                      setAssistantI18n((prev) => ({
                        ...prev,
                        [copyLocale]: { ...prev[copyLocale], title: e.target.value },
                      }))
                    }
                    placeholder={t("Fan AI 助手", "Fan AI Assistant")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-subtitle">{t("助手副标题", "Assistant Subtitle")}</Label>
                  <Input
                    id="ai-subtitle"
                    value={assistantConfig.subtitle}
                    onChange={(e) =>
                      setAssistantI18n((prev) => ({
                        ...prev,
                        [copyLocale]: { ...prev[copyLocale], subtitle: e.target.value },
                      }))
                    }
                    placeholder={t("基于站内公开内容回答", "Answers based on public site content")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-welcome">{t("欢迎语", "Welcome Message")}</Label>
                <Textarea
                  id="ai-welcome"
                  rows={3}
                  value={assistantConfig.welcomeMessage}
                  onChange={(e) =>
                    setAssistantI18n((prev) => ({
                      ...prev,
                      [copyLocale]: { ...prev[copyLocale], welcomeMessage: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-placeholder">{t("输入框占位文案", "Input Placeholder")}</Label>
                <Input
                  id="ai-placeholder"
                  value={assistantConfig.inputPlaceholder}
                  onChange={(e) =>
                    setAssistantI18n((prev) => ({
                      ...prev,
                      [copyLocale]: { ...prev[copyLocale], inputPlaceholder: e.target.value },
                    }))
                  }
                  placeholder={t("输入你的问题...", "Ask your question...")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-fallback">{t("失败提示文案", "Fallback Message")}</Label>
                <Input
                  id="ai-fallback"
                  value={assistantConfig.fallbackMessage}
                  onChange={(e) =>
                    setAssistantI18n((prev) => ({
                      ...prev,
                      [copyLocale]: { ...prev[copyLocale], fallbackMessage: e.target.value },
                    }))
                  }
                  placeholder={t("请求失败了，你可以稍后重试。", "Request failed, please try again later.")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-disabled">{t("未启用提示文案", "Disabled Message")}</Label>
                <Input
                  id="ai-disabled"
                  value={assistantConfig.disabledMessage}
                  onChange={(e) =>
                    setAssistantI18n((prev) => ({
                      ...prev,
                      [copyLocale]: { ...prev[copyLocale], disabledMessage: e.target.value },
                    }))
                  }
                  placeholder={t("AI 助手当前未启用。请稍后再试...", "AI assistant is currently disabled. Please try later...")}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void handleSaveConfig()} disabled={savingConfig || loading}>
                  {savingConfig ? t("保存中...", "Saving...") : t("保存文案配置", "Save copy config")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAssistantI18n((prev) => ({
                      ...prev,
                      [copyLocale]: defaultAIAssistantConfig,
                    }))
                  }}
                  disabled={savingConfig}
                >
                  {t("恢复默认", "Reset to default")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {t("运行状态", "Runtime Status")}
                <StatusBadge ok={!!health?.configured} okText={t("已配置", "Configured")} badText={t("测试模式", "Test Mode")} />
              </CardTitle>
              <CardDescription>{loading ? t("正在加载...", "Loading...") : summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-muted-foreground">Provider</p>
                  <p className="font-medium break-all">{health?.provider || "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-muted-foreground">Chat Model</p>
                  <p className="font-medium break-all">{health?.chatModel || "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-muted-foreground">{t("当前模型别名", "Current Model Alias")}</p>
                  <p className="font-medium break-all">{health?.modelLabel || health?.modelId || "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-muted-foreground">Embedding Model</p>
                  <p className="font-medium break-all">{health?.embeddingModel || "-"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-muted-foreground">Base URL</p>
                  <p className="font-medium break-all">{health?.baseUrl || "-"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge ok={!!health?.hasApiKey} okText={t("API Key 已配置", "API key configured")} badText={t("API Key 未配置", "API key missing")} />
                <StatusBadge ok={!!health?.dbReady} okText={t("知识库表可用", "Knowledge tables ready")} badText={t("知识库表不可用", "Knowledge tables unavailable")} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void loadHealth()} variant="outline" disabled={loading}>
                  {t("刷新状态", "Refresh status")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{t("模型配置", "Model Config")}</CardTitle>
              <CardDescription>{t("在后台配置可用模型白名单，并决定前台是否允许访客切换模型。", "Configure model allowlist and whether visitors can switch models.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ai-enabled">{t("AI 总开关", "AI Master Switch")}</Label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      id="ai-enabled"
                      type="checkbox"
                      className="accent-black"
                      checked={modelConfig.enabled}
                      onChange={(e) => setModelConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    {t("启用 AI 模型调用", "Enable AI model invocation")}
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-switch">{t("前台模型切换", "Frontend Model Switch")}</Label>
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      id="ai-switch"
                      type="checkbox"
                      className="accent-black"
                      checked={modelConfig.allowVisitorModelSwitch}
                      onChange={(e) => setModelConfig((prev) => ({ ...prev, allowVisitorModelSwitch: e.target.checked }))}
                    />
                    {t("允许访客在前台切换模型", "Allow visitors to switch models")}
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ai-base-url">Base URL</Label>
                  <Input
                    id="ai-base-url"
                    value={modelConfig.baseUrl}
                    onChange={(e) => setModelConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-embed-model">Embedding Model</Label>
                  <Input
                    id="ai-embed-model"
                    value={modelConfig.embeddingModel}
                    onChange={(e) => setModelConfig((prev) => ({ ...prev, embeddingModel: e.target.value }))}
                    placeholder="text-embedding-3-small"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-api-key">{t("API Key（留空表示不修改）", "API Key (leave blank to keep current)")}</Label>
                <Input
                  id="ai-api-key"
                  type="password"
                  value={modelConfig.apiKey}
                  onChange={(e) => setModelConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={modelConfig.hasApiKey ? t(`已配置：${modelConfig.apiKeyMasked}`, `Configured: ${modelConfig.apiKeyMasked}`) : "sk-..."}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>{t("可用模型（最多 10 个）", "Available models (up to 10)")}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addModelItem} disabled={modelConfig.models.length >= 10}>
                    {t("新增模型", "Add model")}
                  </Button>
                </div>

                <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">{t("别名 ID", "Alias ID")}</TableHead>
                        <TableHead className="min-w-[180px]">{t("展示名称", "Display Name")}</TableHead>
                        <TableHead className="min-w-[220px]">Chat Model</TableHead>
                        <TableHead className="w-[120px]">{t("启用", "Enabled")}</TableHead>
                        <TableHead className="w-[120px]">{t("默认", "Default")}</TableHead>
                        <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modelConfig.models.map((item, index) => (
                        <TableRow key={`${item.id}-${index}`}>
                          <TableCell>
                            <Input value={item.id} onChange={(e) => updateModelItem(index, { id: e.target.value })} placeholder="default" />
                          </TableCell>
                          <TableCell>
                            <Input value={item.label} onChange={(e) => updateModelItem(index, { label: e.target.value })} placeholder={t("快速模型", "Fast Model")} />
                          </TableCell>
                          <TableCell>
                            <Input value={item.chatModel} onChange={(e) => updateModelItem(index, { chatModel: e.target.value })} placeholder="gpt-4.1-mini" />
                          </TableCell>
                          <TableCell>
                            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <input
                                type="checkbox"
                                className="accent-black"
                                checked={item.enabled}
                                onChange={(e) => updateModelItem(index, { enabled: e.target.checked })}
                              />
                              {t("启用", "Enabled")}
                            </label>
                          </TableCell>
                          <TableCell>
                            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <input
                                type="radio"
                                className="accent-black"
                                name="default-model"
                                checked={modelConfig.defaultModelId === item.id}
                                onChange={() => setModelConfig((prev) => ({ ...prev, defaultModelId: item.id }))}
                              />
                              {t("默认", "Default")}
                            </label>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive h-8 w-8 p-0"
                              onClick={() => removeModelItem(index)}
                              disabled={modelConfig.models.length <= 1}
                            >
                              <i className="ri-delete-bin-line" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void handleSaveModelConfig()} disabled={savingModelConfig || loading}>
                  {savingModelConfig ? t("保存中...", "Saving...") : t("保存模型配置", "Save model config")}
                </Button>
                <Button variant="outline" onClick={() => void loadHealth()} disabled={savingModelConfig || loading}>
                  {t("重新加载", "Reload")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{t("配置说明", "Notes")}</CardTitle>
              <CardDescription>{t("当前版本通过环境变量配置大模型供应商与模型名称。", "Current version supports provider/model config via env vars.")}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>{t("1. 建议优先在本页面配置模型白名单与默认模型；环境变量作为兜底默认值。", "1. Prefer setting allowlist/default model here; env vars act as fallback.")}</p>
              <p>{t("2. 当你修改 Embedding Model 后，建议点击“重建知识库”重新生成向量。", "2. After changing Embedding Model, rebuild knowledge vectors.")}</p>
              <p>{t("3. 未配置 API Key 或关闭 AI 时，助手会以测试模式运行（仍可返回站内引用）。", "3. Without API key or when disabled, assistant runs in test mode.")}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
