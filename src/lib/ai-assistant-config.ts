export type AIAssistantQuickQuestion = {
  question: string
  group?: string
  presetAnswer?: string
  preferPreset?: boolean
  knowledgeId?: string
}

export type AIAssistantManualKnowledge = {
  id: string
  title: string
  question: string
  answer: string
  group?: string
  keywords: string[]
  sourceUrls: string[]
  enabled: boolean
  showAsQuickQuestion: boolean
  sortOrder: number
}

export type AIAssistantManualKnowledgeMode = "recommend_only" | "direct_answer" | "hybrid"
export type AIAssistantRetrievalSources = {
  posts: boolean
  works: boolean
  tutorials: boolean
  about: boolean
  manualKnowledge: boolean
}

export type AIAssistantConfig = {
  enabled: boolean
  launcherLabel: string
  title: string
  subtitle: string
  welcomeMessage: string
  inputPlaceholder: string
  disabledMessage: string
  fallbackMessage: string
  quickQuestions: AIAssistantQuickQuestion[]
  manualKnowledge: AIAssistantManualKnowledge[]
  manualKnowledgeMode: AIAssistantManualKnowledgeMode
  retrievalSources: AIAssistantRetrievalSources
  guardrails: {
    maxRequestsPerMinute: number
    maxQuestionLength: number
    cacheTtlSeconds: number
    dailyTokenBudget: number
    strictInputSafety: boolean
  }
}

export const defaultAIAssistantConfig: AIAssistantConfig = {
  enabled: true,
  launcherLabel: "AI 助手",
  title: "站点 AI 助手",
  subtitle: "基于站内公开内容回答",
  welcomeMessage: "你好，我是站点助手。你可以问我关于作品、文章、教程和合作方式的问题。",
  inputPlaceholder: "输入你的问题...",
  disabledMessage: "AI 助手当前未启用。请稍后再试，或直接通过站点联系方式联系我。",
  fallbackMessage: "请求失败了，你可以稍后重试。",
  quickQuestions: [],
  manualKnowledge: [],
  manualKnowledgeMode: "recommend_only",
  retrievalSources: {
    posts: true,
    works: true,
    tutorials: true,
    about: true,
    manualKnowledge: true,
  },
  guardrails: {
    maxRequestsPerMinute: 12,
    maxQuestionLength: 800,
    cacheTtlSeconds: 300,
    dailyTokenBudget: 150000,
    strictInputSafety: true,
  },
}

function normalizeManualKnowledge(raw: unknown): AIAssistantManualKnowledge[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const obj = item as Record<string, unknown>
      const idRaw = typeof obj.id === "string" ? obj.id.trim() : ""
      const id = idRaw || `manual-${index + 1}`
      const question = typeof obj.question === "string" ? obj.question.trim() : ""
      const answer = typeof obj.answer === "string" ? obj.answer.trim() : ""
      if (!question || !answer) return null
      const titleRaw = typeof obj.title === "string" ? obj.title.trim() : ""
      const title = titleRaw || question
      const group = typeof obj.group === "string" ? obj.group.trim() : ""
      const keywords = Array.isArray(obj.keywords)
        ? obj.keywords
            .filter((k): k is string => typeof k === "string")
            .map((k) => k.trim())
            .filter(Boolean)
            .slice(0, 20)
        : []
      const sourceUrlsRaw = Array.isArray(obj.sourceUrls)
        ? obj.sourceUrls
        : typeof obj.sourceUrl === "string" && obj.sourceUrl.trim()
          ? [obj.sourceUrl.trim()]
          : []
      const sourceUrls = sourceUrlsRaw
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim())
        .filter(Boolean)
        .slice(0, 8)
      return {
        id,
        title,
        question,
        answer,
        ...(group ? { group } : {}),
        keywords,
        sourceUrls,
        enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
        showAsQuickQuestion: typeof obj.showAsQuickQuestion === "boolean" ? obj.showAsQuickQuestion : true,
        sortOrder: typeof obj.sortOrder === "number" && Number.isFinite(obj.sortOrder) ? Math.max(0, Math.round(obj.sortOrder)) : index,
      }
    })
    .filter((item): item is AIAssistantManualKnowledge => !!item)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 200)
}

function normalizeInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function normalizeGuardrails(raw: unknown): AIAssistantConfig["guardrails"] {
  const base = defaultAIAssistantConfig.guardrails
  if (!raw || typeof raw !== "object") return { ...base }
  const obj = raw as Partial<AIAssistantConfig["guardrails"]>
  return {
    maxRequestsPerMinute: normalizeInt(obj.maxRequestsPerMinute, base.maxRequestsPerMinute, 3, 120),
    maxQuestionLength: normalizeInt(obj.maxQuestionLength, base.maxQuestionLength, 100, 3000),
    cacheTtlSeconds: normalizeInt(obj.cacheTtlSeconds, base.cacheTtlSeconds, 30, 3600),
    dailyTokenBudget: normalizeInt(obj.dailyTokenBudget, base.dailyTokenBudget, 1000, 5000000),
    strictInputSafety: typeof obj.strictInputSafety === "boolean" ? obj.strictInputSafety : base.strictInputSafety,
  }
}

function normalizeRetrievalSources(raw: unknown): AIAssistantRetrievalSources {
  const base = defaultAIAssistantConfig.retrievalSources
  if (!raw || typeof raw !== "object") return { ...base }
  const obj = raw as Partial<AIAssistantRetrievalSources>
  return {
    posts: typeof obj.posts === "boolean" ? obj.posts : base.posts,
    works: typeof obj.works === "boolean" ? obj.works : base.works,
    tutorials: typeof obj.tutorials === "boolean" ? obj.tutorials : base.tutorials,
    about: typeof obj.about === "boolean" ? obj.about : base.about,
    manualKnowledge: typeof obj.manualKnowledge === "boolean" ? obj.manualKnowledge : base.manualKnowledge,
  }
}

export function normalizeAIAssistantConfig(raw: unknown): AIAssistantConfig {
  if (!raw || typeof raw !== "object") return { ...defaultAIAssistantConfig }
  const obj = raw as Partial<AIAssistantConfig>
  const manualKnowledgeMode: AIAssistantManualKnowledgeMode =
    obj.manualKnowledgeMode === "direct_answer" || obj.manualKnowledgeMode === "hybrid" || obj.manualKnowledgeMode === "recommend_only"
      ? obj.manualKnowledgeMode
      : defaultAIAssistantConfig.manualKnowledgeMode
  const retrievalSources = normalizeRetrievalSources((obj as Record<string, unknown>).retrievalSources)
  const manualKnowledge = normalizeManualKnowledge((obj as Record<string, unknown>).manualKnowledge)
  const derivedQuickQuestions = manualKnowledge
    .filter((item) => item.enabled && item.showAsQuickQuestion)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 21)
    .map((item) => ({
      question: item.question,
      group: item.group,
      presetAnswer: item.answer,
      preferPreset: true,
      knowledgeId: item.id,
    }))
  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : defaultAIAssistantConfig.enabled,
    launcherLabel:
      typeof obj.launcherLabel === "string" && obj.launcherLabel.trim()
        ? obj.launcherLabel.trim()
        : defaultAIAssistantConfig.launcherLabel,
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : defaultAIAssistantConfig.title,
    subtitle:
      typeof obj.subtitle === "string" && obj.subtitle.trim()
        ? obj.subtitle.trim()
        : defaultAIAssistantConfig.subtitle,
    welcomeMessage:
      typeof obj.welcomeMessage === "string" && obj.welcomeMessage.trim()
        ? obj.welcomeMessage.trim()
        : defaultAIAssistantConfig.welcomeMessage,
    inputPlaceholder:
      typeof obj.inputPlaceholder === "string" && obj.inputPlaceholder.trim()
        ? obj.inputPlaceholder.trim()
        : defaultAIAssistantConfig.inputPlaceholder,
    disabledMessage:
      typeof obj.disabledMessage === "string" && obj.disabledMessage.trim()
        ? obj.disabledMessage.trim()
        : defaultAIAssistantConfig.disabledMessage,
    fallbackMessage:
      typeof obj.fallbackMessage === "string" && obj.fallbackMessage.trim()
        ? obj.fallbackMessage.trim()
        : defaultAIAssistantConfig.fallbackMessage,
    quickQuestions: derivedQuickQuestions,
    manualKnowledge,
    manualKnowledgeMode,
    retrievalSources,
    guardrails: normalizeGuardrails(obj.guardrails),
  }
}
