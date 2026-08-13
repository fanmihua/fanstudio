"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { detectLocaleFromPath } from "@/lib/i18n-path"
import {
  defaultAIAssistantConfig,
  normalizeAIAssistantConfig,
  type AIAssistantConfig,
  type AIAssistantQuickQuestion,
} from "@/lib/ai-assistant-config"

type Role = "user" | "assistant"

type Citation = {
  title: string
  url: string
  snippet: string
  sourceType: "POST" | "WORK" | "TUTORIAL" | "SETTINGS"
}

type ChatMessage = {
  id: string
  role: Role
  content: string
  citations?: Citation[]
  progressStage?: "searching" | "generating" | "completed"
  draftContent?: string
  pendingCitations?: Citation[]
}

type FrontendModelConfig = {
  allowVisitorModelSwitch: boolean
  defaultModelId: string
  activeModelId: string
  models: Array<{ id: string; label: string }>
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function keepWorkCitations(citations: Citation[]): Citation[] {
  return citations
    .filter((item, index, list) => list.findIndex((v) => v.url === item.url) === index)
    .slice(0, 3)
}

function getProgressLabel(stage: ChatMessage["progressStage"], txt: (zh: string, en: string) => string) {
  if (stage === "generating") {
    return txt("正在生成回复", "Generating reply")
  }
  if (stage === "completed") {
    return txt("回答已准备好", "Answer ready")
  }
  return txt("正在思考中", "Thinking")
}

function getProgressDetails(stage: ChatMessage["progressStage"], txt: (zh: string, en: string) => string) {
  if (stage === "generating") {
    return txt("正在整理相关内容，并组织成更自然的回答。", "Organizing the relevant content into a more natural reply.")
  }
  if (stage === "completed") {
    return txt("回答已生成完成。如果附带来源链接，你可以直接点击继续查看。", "The answer is ready. If reference links are included, you can open them directly.")
  }
  return txt("正在理解你的问题，并检索站内公开内容。", "Understanding your question and searching public site content.")
}

function isInternalUrl(url: string): boolean {
  return url.startsWith("/")
}

function linkTargetProps(url: string) {
  return isInternalUrl(url) ? {} : { target: "_blank", rel: "noreferrer" }
}

function renderInlineLinks(
  line: string,
  citations: Citation[] | undefined,
  txt: (zh: string, en: string) => string,
) {
  const regex =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+|\/(?:works\/[A-Za-z0-9-]+|blog\/[A-Za-z0-9-]+|tutorials#[A-Za-z0-9-]+|about))/g
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(line)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (start > last) parts.push(line.slice(last, start))
    const label = match[1]
    const url = match[2] || match[3]
    const citation = citations?.find((item) => item.url === url)
    const linkText = label || citation?.title || (url.startsWith("/") ? txt("查看详情", "View details") : url)
    parts.push(
      <a
        key={`${url}-${start}`}
        href={url}
        {...linkTargetProps(url)}
        className="underline underline-offset-2 decoration-foreground/40 hover:decoration-foreground font-medium"
      >
        {linkText}
      </a>,
    )
    last = end
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

function renderAssistantRichText(
  content: string,
  citations: Citation[] | undefined,
  txt: (zh: string, en: string) => string,
) {
  const lines = (content || "").split("\n")
  return (
    <div className="space-y-2">
      {lines.map((raw, index) => {
        const line = raw
          .replace(/^#{1,6}\s+/, "")
          .replace(/^\s*(?:[-*•]|\d+[.)、])\s+/, "")
          .replace(/\*\*/g, "")
          .trim()
        if (!line) return <div key={`gap-${index}`} className="h-1" />
        return (
          <p key={`p-${index}`} className="leading-relaxed">
            {renderInlineLinks(line, citations, txt)}
          </p>
        )
      })}
    </div>
  )
}

function quickQuestionIcon(index: number): string {
  const icons = [
    "ri-user-smile-line",
    "ri-graduation-cap-line",
    "ri-vip-crown-line",
    "ri-box-3-line",
    "ri-code-s-slash-line",
    "ri-palette-line",
    "ri-mail-send-line",
  ]
  return icons[index % icons.length]
}

function quickQuestionGroupIcon(index: number): string {
  const icons = [
    "ri-compass-3-line",
    "ri-graduation-cap-line",
    "ri-vip-crown-line",
    "ri-box-3-line",
    "ri-code-s-slash-line",
    "ri-palette-line",
    "ri-layout-masonry-line",
  ]
  return icons[index % icons.length]
}

export function SiteAIAssistant() {
  const pathname = usePathname()
  const locale = detectLocaleFromPath(pathname || "/")
  const isEn = locale === "en"
  const txt = (zh: string, en: string) => (isEn ? en : zh)
  const phaseLabels = {
    searching: txt("正在检索站内公开内容", "Searching public site content"),
    generating: txt("正在生成回答", "Generating answer"),
    completed: txt("回答生成完成", "Answer ready"),
  }
  const [config, setConfig] = useState<AIAssistantConfig>(defaultAIAssistantConfig)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [modelConfig, setModelConfig] = useState<FrontendModelConfig>({
    allowVisitorModelSwitch: false,
    defaultModelId: "",
    activeModelId: "",
    models: [],
  })
  const [selectedModelId, setSelectedModelId] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [expandedProgress, setExpandedProgress] = useState<Record<string, boolean>>({})
  const [pendingAutoQuestion, setPendingAutoQuestion] = useState<string>("")
  const [activeQuickGroup, setActiveQuickGroup] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const sendMessageRef = useRef<(raw: string) => void>(() => {})
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const compactHistory = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages],
  )

  const hasUserMessage = useMemo(() => messages.some((m) => m.role === "user"), [messages])
  const maxQuestionLength = config.guardrails?.maxQuestionLength ?? 800
  const inputLength = input.trim().length
  const isOverLimit = inputLength > maxQuestionLength
  const quickQuestionGroups = useMemo(() => {
    const fallbackGroup = txt("先了解", "Start Here")
    const groups: Array<{ label: string; items: AIAssistantQuickQuestion[] }> = []
    const indexByLabel = new Map<string, number>()
    config.quickQuestions.forEach((item) => {
      const label = (item.group || fallbackGroup).trim() || fallbackGroup
      const existingIndex = indexByLabel.get(label)
      if (existingIndex == null) {
        indexByLabel.set(label, groups.length)
        groups.push({ label, items: [item] })
      } else {
        groups[existingIndex].items.push(item)
      }
    })
    return groups
  }, [config.quickQuestions, isEn])

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const node = listRef.current
      if (!node) return
      node.scrollTop = node.scrollHeight
    })
  }

  function resizeInput() {
    const node = inputRef.current
    if (!node) return
    node.style.height = "0px"
    const maxHeight = 24 * 4 + 8
    const next = Math.min(node.scrollHeight, maxHeight)
    node.style.height = `${Math.max(72, next)}px`
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden"
  }

  function updateAssistantMessage(id: string, updater: (prev: ChatMessage) => ChatMessage) {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? updater(msg) : msg)))
  }

  function clearConversation() {
    if (loading) return
    setMessages([])
    setExpandedProgress({})
    setPendingAutoQuestion("")
    setInput("")
    if (inputRef.current) {
      inputRef.current.style.height = "72px"
      inputRef.current.style.overflowY = "hidden"
    }
  }

  function renderQuickQuestionCards(mode: "welcome" | "compact") {
    if (config.quickQuestions.length === 0 || quickQuestionGroups.length === 0) return null
    const compact = mode === "compact"
    const selectedGroup = quickQuestionGroups.find((group) => group.label === activeQuickGroup) ?? quickQuestionGroups[0]
    const visibleQuestions = selectedGroup.items.slice(0, 3)

    return (
      <div className={cn(compact ? "space-y-1.5" : "space-y-2")}>
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-medium text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
            {txt("先点一个问题", "Try a question")}
          </p>
          <span className="text-[10px] text-muted-foreground/80">{txt("快捷提问", "Quick prompts")}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quickQuestionGroups.map((group, index) => {
            const active = group.label === selectedGroup.label
            return (
              <button
                key={`${mode}-group-${group.label}`}
                type="button"
                onClick={() => setActiveQuickGroup(group.label)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-none transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground",
                )}
              >
                <i className={cn(quickQuestionGroupIcon(index), "text-[11px]")} />
                {group.label}
              </button>
            )
          })}
        </div>
        <div className={cn(compact ? "grid grid-cols-1 sm:grid-cols-3 gap-1.5" : "grid grid-cols-1 sm:grid-cols-3 gap-1.5")}>
          {visibleQuestions.map((q, index) => (
            <button
              key={`${mode}-${selectedGroup.label}-${q.question}-${index}`}
              type="button"
              onClick={() => answerQuickQuestion(q)}
              disabled={loading}
              className={cn(
                "group rounded-lg border border-border/70 bg-background/90 text-left text-foreground shadow-sm transition-all hover:border-foreground/25 hover:bg-background disabled:pointer-events-none disabled:opacity-60",
                compact ? "min-h-[40px] px-2.5 py-2" : "min-h-[46px] px-2.5 py-2",
              )}
            >
              <span className="flex h-full items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 grid shrink-0 place-items-center rounded-md bg-muted text-foreground/75 transition-colors group-hover:bg-foreground group-hover:text-background",
                    compact ? "h-[18px] w-[18px]" : "h-5 w-5",
                  )}
                >
                  <i className={cn(quickQuestionIcon(index), compact ? "text-xs" : "text-sm")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("line-clamp-2 font-medium leading-snug", compact ? "text-xs" : "text-[13px]")}>
                    {q.question}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetch(`/api/settings?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((settingsData) => {
        const assistant = normalizeAIAssistantConfig(settingsData?.aiAssistant)
        setConfig(assistant)
      })
      .catch(() => {
        setConfig(defaultAIAssistantConfig)
      })
  }, [locale])

  useEffect(() => {
    if (quickQuestionGroups.length === 0) return
    if (quickQuestionGroups.some((group) => group.label === activeQuickGroup)) return
    setActiveQuickGroup(quickQuestionGroups[0].label)
  }, [quickQuestionGroups, activeQuickGroup])

  useEffect(() => {
    fetch("/api/ai/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((modelsData) => {
        const models = Array.isArray(modelsData?.models)
          ? (modelsData.models as Array<{ id?: string; label?: string }>)
              .filter((item) => typeof item?.id === "string" && item.id)
              .map((item) => ({
                id: item.id as string,
                label: typeof item.label === "string" && item.label ? item.label : (item.id as string),
              }))
              .slice(0, 10)
          : []

        const activeModelId = typeof modelsData?.activeModelId === "string" ? modelsData.activeModelId : models[0]?.id ?? ""
        const defaultModelId = typeof modelsData?.defaultModelId === "string" ? modelsData.defaultModelId : activeModelId
        const allowVisitorModelSwitch = Boolean(modelsData?.allowVisitorModelSwitch)
        setModelConfig({ allowVisitorModelSwitch, defaultModelId, activeModelId, models })
        setSelectedModelId(activeModelId)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ question?: string; autoSend?: boolean }>
      const question = (custom.detail?.question || "").trim()
      const autoSend = custom.detail?.autoSend === true
      setOpen(true)
      if (!question) return
      if (autoSend) {
        setPendingAutoQuestion(question)
      } else {
        setInput(question)
      }
    }
    window.addEventListener("site-ai-assistant:open", handler as EventListener)
    return () => {
      window.removeEventListener("site-ai-assistant:open", handler as EventListener)
    }
  }, [])

  async function sendMessage(raw: string, quickQuestion?: Pick<AIAssistantQuickQuestion, "knowledgeId" | "preferPreset">) {
    const text = raw.trim()
    if (!text || loading || text.length > maxQuestionLength) return

    const userMessage: ChatMessage = { id: makeId(), role: "user", content: text }
    const assistantId = makeId()
    const placeholder: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      progressStage: "searching",
      draftContent: "",
      pendingCitations: [],
    }

    setMessages((prev) => [...prev, userMessage, placeholder])
    setExpandedProgress((prev) => ({ ...prev, [assistantId]: true }))
    setInput("")
    if (inputRef.current) {
      inputRef.current.style.height = "72px"
      inputRef.current.style.overflowY = "hidden"
    }
    setLoading(true)
    scrollToBottom()

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          locale,
          history: compactHistory.slice(-8),
          modelId: selectedModelId || undefined,
          options: {
            stream: true,
            knowledgeId: quickQuestion?.knowledgeId,
            preferPreset: quickQuestion?.preferPreset === true,
          },
        }),
      })

      if (!res.ok) {
        if (res.status === 503) {
          updateAssistantMessage(assistantId, () => ({
            id: assistantId,
            role: "assistant",
            content: config.disabledMessage,
          }))
          return
        }
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data?.detail === "string" ? data.detail : txt("请求失败", "Request failed"))
      }

      const contentType = res.headers.get("content-type") || ""
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let typingQueue: Promise<void> = Promise.resolve()
        let typingStarted = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const frames = buffer.split("\n\n")
          buffer = frames.pop() ?? ""

          for (const frame of frames) {
            const line = frame.split("\n").find((row) => row.startsWith("data: "))
            if (!line) continue

            const payload = JSON.parse(line.slice(6)) as {
              type?: string
              text?: string
              citations?: Citation[]
            }

            if (payload.type === "meta") {
              updateAssistantMessage(assistantId, (prev) => ({
                ...prev,
                pendingCitations: Array.isArray(payload.citations) ? keepWorkCitations(payload.citations) : [],
              }))
              scrollToBottom()
            } else if (payload.type === "progress") {
              const text = payload.text ?? ""
              updateAssistantMessage(assistantId, (prev) => ({
                ...prev,
                progressStage: text.includes(phaseLabels.generating) ? "generating" : prev.progressStage ?? "searching",
              }))
              scrollToBottom()
            } else if (payload.type === "delta") {
              const deltaText = payload.text ?? ""
              if (deltaText) {
                updateAssistantMessage(assistantId, (prev) => ({
                  ...prev,
                  progressStage: "generating",
                }))
                typingQueue = typingQueue.then(async () => {
                  if (!typingStarted) {
                    typingStarted = true
                    await sleep(120)
                  }
                  for (const ch of deltaText) {
                    updateAssistantMessage(assistantId, (prev) => ({
                      ...prev,
                      draftContent: `${prev.draftContent ?? ""}${ch}`,
                    }))
                    scrollToBottom()
                    await sleep(8)
                  }
                })
              }
            } else if (payload.type === "done") {
              await typingQueue
              updateAssistantMessage(assistantId, (prev) => ({
                ...prev,
                content: prev.draftContent || txt("我暂时无法回答这个问题。", "I cannot answer that for now."),
                citations: prev.pendingCitations ?? [],
                progressStage: "completed",
              }))
              setExpandedProgress((prev) => ({ ...prev, [assistantId]: false }))
            }
          }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        updateAssistantMessage(assistantId, (prev) => ({
          ...prev,
          content: typeof data?.answer === "string" ? data.answer : txt("我暂时无法回答这个问题。", "I cannot answer that for now."),
          citations: Array.isArray(data?.citations) ? keepWorkCitations(data.citations as Citation[]) : [],
          progressStage: "completed",
        }))
        setExpandedProgress((prev) => ({ ...prev, [assistantId]: false }))
      }
    } catch {
      updateAssistantMessage(assistantId, () => ({
        id: assistantId,
        role: "assistant",
        content: config.fallbackMessage,
        progressStage: "completed",
      }))
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  sendMessageRef.current = (raw: string) => {
    void sendMessage(raw)
  }

  useEffect(() => {
    resizeInput()
  }, [input])

  useEffect(() => {
    if (!open || loading) return
    const question = pendingAutoQuestion.trim()
    if (!question) return
    setPendingAutoQuestion("")
    sendMessageRef.current(question)
  }, [open, loading, pendingAutoQuestion])

  function answerQuickQuestion(item: AIAssistantQuickQuestion) {
    const text = item.question.trim()
    if (!text || loading) return
    void sendMessage(text, { knowledgeId: item.knowledgeId, preferPreset: item.preferPreset })
  }

  if (!config.enabled) return null

  return (
    <>
      <div className="fixed right-4 bottom-24 lg:bottom-6 z-50 pointer-events-auto">
        <Button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ai-launcher h-11 px-4 rounded-full text-[color:var(--background)] hover:opacity-95"
          style={{ backgroundColor: "var(--foreground)" }}
          aria-label={`${txt("打开", "Open")} ${config.launcherLabel || txt("AI 助手", "AI Assistant")}`}
        >
          {config.launcherLabel || txt("AI 助手", "AI Assistant")}
        </Button>
      </div>

      {open ? (
        <div
          className="fixed z-50 right-4 left-4 lg:left-auto bottom-24 lg:bottom-6 w-auto lg:w-[520px] h-[82vh] lg:h-[86vh] max-h-[860px] rounded-2xl border border-border/70 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, color-mix(in srgb, var(--color-pride-2) 10%, transparent), transparent 140px)",
          }}
        >
          <header className="px-5 py-3.5 bg-muted/15 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground leading-none">{config.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{config.subtitle}</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={clearConversation}
                  disabled={loading}
                  aria-label={txt("清空对话", "Clear conversation")}
                  title={txt("清空对话", "Clear conversation")}
                >
                  <i className="ri-delete-bin-line text-base" />
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label={txt("关闭 AI 助手", "Close AI Assistant")}>
                <i className="ri-close-line text-base" />
              </Button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background/35">
            {!hasUserMessage ? (
              <div className="rounded-2xl border border-border/70 bg-muted/45 p-3 space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                <p className="text-sm text-foreground leading-relaxed">{config.welcomeMessage}</p>
                {renderQuickQuestionCards("welcome")}
              </div>
            ) : null}

            {messages.map((message, index) => {
              const isStreamingMessage = loading && index === messages.length - 1 && message.role === "assistant"
              return (
                <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap space-y-3",
                      message.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-accent text-accent-foreground rounded-bl-md",
                    )}
                  >
                    {message.role === "assistant" && message.progressStage ? (
                      <div className="mb-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-[11px] text-muted-foreground">
                        <button
                          type="button"
                          className="w-full flex items-start justify-between gap-2 text-left"
                          onClick={() =>
                            setExpandedProgress((prev) => ({
                              ...prev,
                              [message.id]: !prev[message.id],
                            }))
                          }
                        >
                          <span className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-1 inline-block h-1.5 w-1.5 rounded-full",
                                message.progressStage === "completed"
                                  ? "bg-foreground/50"
                                  : message.progressStage === "generating"
                                    ? "bg-primary animate-pulse"
                                    : "bg-foreground/40",
                              )}
                            />
                            <span className="block text-foreground/80 font-medium">
                              {getProgressLabel(message.progressStage, txt)}
                            </span>
                          </span>
                          <i
                            className={cn(
                              "ri-arrow-down-s-line mt-0.5 transition-transform",
                              expandedProgress[message.id] ? "rotate-180" : "",
                            )}
                          />
                        </button>
                        {expandedProgress[message.id] ? (
                          <div className="mt-2 rounded-md border border-border/50 bg-background/70 px-3 py-2 leading-relaxed whitespace-pre-line">
                            {getProgressDetails(message.progressStage, txt)}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {message.role === "assistant" ? (
                      (() => {
                        const assistantText =
                          message.progressStage === "completed"
                            ? message.content
                            : (message.draftContent || message.content || "")
                        return assistantText ? renderAssistantRichText(assistantText, message.citations, txt) : <p className="leading-relaxed" />
                      })()
                    ) : (
                      <p className="leading-relaxed">{message.content}</p>
                    )}
                    {message.role === "assistant" && (message.citations?.length || 0) > 0 ? (
                      <div className="pt-1 text-xs leading-relaxed text-muted-foreground">
                        <span>{txt("相关链接：", "Related links: ")}</span>
                        {message.citations?.map((citation, citationIndex) => (
                          <span key={`${message.id}-citation-${citationIndex}`}>
                            {citationIndex > 0 ? <span> / </span> : null}
                            <a
                              href={citation.url}
                              {...linkTargetProps(citation.url)}
                              className="text-foreground/85 underline underline-offset-2 decoration-foreground/35 hover:decoration-foreground"
                            >
                              {citation.title}
                            </a>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {isStreamingMessage ? <span className="ml-0.5 inline-block w-1.5 h-4 align-middle bg-current/70 animate-pulse rounded-sm" /> : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 bg-muted/20">
            {hasUserMessage && config.quickQuestions.length > 0 ? (
              <div className="mb-2 rounded-xl border border-border/60 bg-background/80 p-2.5 shadow-sm">
                {renderQuickQuestionCards("compact")}
              </div>
            ) : null}
            <div className="relative rounded-2xl border border-border/70 bg-background px-4 pt-2.5 pb-2.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void sendMessage(input)
                  }
                }}
                rows={2}
                placeholder={config.inputPlaceholder}
                className="w-full min-h-[72px] resize-none bg-transparent px-2 pt-1 pb-10 pr-[86px] text-left text-sm leading-6 outline-none placeholder:leading-6"
              />

              {modelConfig.allowVisitorModelSwitch && modelConfig.models.length > 1 ? (
                <div className="absolute left-6 bottom-2.5">
                  <Select value={selectedModelId || modelConfig.defaultModelId} onValueChange={setSelectedModelId} disabled={loading}>
                    <SelectTrigger className="h-7 w-auto border-none bg-transparent px-0 text-left text-sm leading-6 text-muted-foreground shadow-none rounded-none gap-1 focus-visible:ring-0 focus-visible:border-transparent [&_[data-slot=select-value]]:justify-start [&_[data-slot=select-value]]:text-left">
                      <SelectValue placeholder={txt("模型", "Model")} />
                    </SelectTrigger>
                    <SelectContent side="top" align="start">
                      {modelConfig.models.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="absolute right-4 bottom-2.5">
                <Button type="button" onClick={() => void sendMessage(input)} disabled={loading || !input.trim() || isOverLimit} className="h-8 w-8 rounded-full p-0" aria-label={txt("发送", "Send")}>
                  <i className="ri-send-plane-fill text-sm" />
                </Button>
              </div>
              <div className={cn("absolute right-[3.25rem] bottom-2.5 h-8 flex items-center text-[10px] tabular-nums", isOverLimit ? "text-destructive" : "text-muted-foreground")}>
                {inputLength}/{maxQuestionLength}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
