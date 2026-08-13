import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createAIProvider } from "@/lib/ai"
import { type AIChatMessage, type AIProviderConfig } from "@/lib/ai/provider"
import { resolveAIConfig } from "@/lib/ai/runtime-config"
import { htmlToPlainText, htmlToPlainTextWithBreaks, jsonToPlainText } from "@/lib/content-format"
import { normalizeAboutModules } from "@/lib/about-types"
import {
  defaultAIAssistantConfig,
  normalizeAIAssistantConfig,
  type AIAssistantManualKnowledge,
  type AIAssistantManualKnowledgeMode,
  type AIAssistantRetrievalSources,
} from "@/lib/ai-assistant-config"

export const dynamic = "force-dynamic"

type Citation = {
  title: string
  url: string
  snippet: string
  sourceType: "POST" | "WORK" | "TUTORIAL" | "SETTINGS"
}

type Candidate = {
  title: string
  url: string
  sourceType: Citation["sourceType"]
  text: string
  updatedAt: Date
  embeddings: number[][]
}

type ChatPayload = {
  sessionId: string | null
  answer: string
  citations: Citation[]
  confidence: number
  trace: string[]
}

type RouteMode = "rule" | "retrieval" | "model"

const CITATION_TOP_SCORE_THRESHOLD = 0.9
const CITATION_AVG_TOP3_THRESHOLD = 0.3
const CITATION_ITEM_SCORE_THRESHOLD = 0.6
const HARD_BLOCK_SCORE_THRESHOLD = 0.05
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const DEFAULT_CACHE_TTL_SECONDS = 300
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 12
const DEFAULT_MAX_MESSAGE_LENGTH = 800
const DEFAULT_DAILY_TOKEN_BUDGET = 150000

type RateLimitState = { count: number; windowStart: number }
type CacheState = { expiresAt: number; payload: ChatPayload }
type BudgetState = { date: string; used: number }

const runtimeCache = globalThis as typeof globalThis & {
  __aiChatRateMap?: Map<string, RateLimitState>
  __aiChatPayloadCache?: Map<string, CacheState>
  __aiChatBudgetState?: BudgetState
}

function getRateMap(): Map<string, RateLimitState> {
  if (!runtimeCache.__aiChatRateMap) runtimeCache.__aiChatRateMap = new Map()
  return runtimeCache.__aiChatRateMap
}

function getPayloadCache(): Map<string, CacheState> {
  if (!runtimeCache.__aiChatPayloadCache) runtimeCache.__aiChatPayloadCache = new Map()
  return runtimeCache.__aiChatPayloadCache
}

function getClientIp(request: NextRequest): string {
  // 优先 nginx 写入的 x-real-ip（不可伪造）；回退取 x-forwarded-for 最后一段（nginx 追加的真实对端）。
  // 绝不取首段——那是客户端自带、可伪造的值，取首段会让限流被伪造头绕过。
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return "unknown"
}

function checkRateLimit(key: string, maxRequestsPerMinute: number): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const map = getRateMap()
  const state = map.get(key)
  if (!state || now - state.windowStart >= RATE_LIMIT_WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now })
    return { ok: true, retryAfterSeconds: 0 }
  }
  if (state.count >= maxRequestsPerMinute) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - state.windowStart)
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) }
  }
  state.count += 1
  map.set(key, state)
  return { ok: true, retryAfterSeconds: 0 }
}

function normalizeCacheKey(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim()
}

function readCache(key: string): ChatPayload | null {
  const map = getPayloadCache()
  const now = Date.now()
  const row = map.get(key)
  if (!row) return null
  if (row.expiresAt <= now) {
    map.delete(key)
    return null
  }
  return row.payload
}

function writeCache(key: string, payload: ChatPayload, ttlMs: number): void {
  const map = getPayloadCache()
  map.set(key, { expiresAt: Date.now() + ttlMs, payload })
}

function detectUnsafeMessage(input: string, maxMessageLength: number, strictInputSafety: boolean, isEn: boolean): string | null {
  const text = input.trim()
  if (!text) return isEn ? "Please enter a question." : "请输入问题。"
  if (text.length > maxMessageLength) {
    return isEn ? `Your question is too long. Keep it within ${maxMessageLength} characters.` : `问题过长，请控制在 ${maxMessageLength} 字以内。`
  }
  if (!strictInputSafety) return null
  if (/<script\b|<\/script>/i.test(text)) return isEn ? "Your request includes unsafe content. Please revise and try again." : "请求包含不安全内容，请修改后重试。"
  if (/(ignore\s+all\s+previous|jailbreak|越狱提示|系统提示词|泄露.*(密钥|apikey|api key))/i.test(text)) {
    return isEn ? "Your request contains high-risk instructions and has been blocked." : "请求包含高风险指令，已被拦截。"
  }
  return null
}

function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length * 1.2))
}

function getTodayUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function reserveDailyTokenBudget(estimatedTokens: number, limit: number): { ok: boolean; used: number; limit: number; remaining: number } {
  const today = getTodayUtcDateKey()
  const current = runtimeCache.__aiChatBudgetState
  const state: BudgetState = !current || current.date !== today ? { date: today, used: 0 } : current
  if (state.used + estimatedTokens > limit) {
    const remaining = Math.max(0, limit - state.used)
    runtimeCache.__aiChatBudgetState = state
    return { ok: false, used: state.used, limit, remaining }
  }
  state.used += estimatedTokens
  runtimeCache.__aiChatBudgetState = state
  return { ok: true, used: state.used, limit, remaining: Math.max(0, limit - state.used) }
}

type IdentityIntent = "assistant" | "owner" | "none"

function detectIdentityIntent(message: string): IdentityIntent {
  const text = message.trim().toLowerCase()
  if (!text) return "none"

  const assistantIntent =
    /(ai助手|助手本身|你这个助手|这个助手|站点助手|机器人|这个ai|你是助手吗|你是ai吗|你是机器人吗)/.test(text) ||
    (/介绍/.test(text) && /(助手|ai|机器人)/.test(text))
  if (assistantIntent) return "assistant"

  const ownerIntent =
    /(介绍一下你自己|介绍你自己|介绍一下自己|介绍你|你是谁|你是做什么的|你擅长什么|你擅长哪些|你能做什么项目|你做什么项目)/.test(
      text,
    ) ||
    (/你自己/.test(text) && !/(助手|ai|机器人)/.test(text))
  if (ownerIntent) return "owner"

  return "none"
}

function isSmallTalkMessage(input: string): boolean {
  const text = input.trim().toLowerCase()
  if (!text) return false
  const exact = new Set([
    "hi",
    "hello",
    "hey",
    "你好",
    "嗨",
    "哈喽",
    "在吗",
    "你能做什么",
    "你会什么",
    "你能回答啥问题",
    "你能回答什么问题",
  ])
  if (exact.has(text)) return true
  const patterns = [
    /^你好/,
    /^嗨/,
    /^在吗/,
    /闲聊|无聊|聊聊|陪我聊|你能回答(啥|什么)问题|能问你(啥|什么)/,
    /^hello/,
    /^hi\b/,
  ]
  return patterns.some((p) => p.test(text))
}

function isCapabilityQuestionMessage(input: string): boolean {
  const text = input.trim().toLowerCase()
  if (!text) return false
  return /(你能|你会|可以|能不能).*(回答|聊|做|帮).*(啥|什么|哪些|问题)|可以问你(啥|什么|哪些问题)|能问你(啥|什么|哪些)|问你哪些问题|你擅长回答|你能做什么|你会什么/.test(text)
}

function buildCapabilityAnswer(isEn: boolean): string {
  if (isEn) {
    return "You can ask me safe general questions, casual chat topics, learning or creative thinking prompts, and questions about this site.\n\nFor site-related questions, I can help with the site owner's works, courses, tutorials, collaboration details, and where to start reading."
  }

  return "你可以问我安全的通用问题、闲聊话题、学习建议、创作思路，也可以问这个网站相关的内容。\n\n如果你想了解站点主人，我可以帮你看作品、课程、教程、合作方式，以及从哪里开始看更合适。"
}

function shouldUseCapabilityFallback(answer: string, isEn: boolean): boolean {
  if (!answer.trim()) return true
  if (isEn) return /missing context|no context|not enough context|no site details|retrieval/i.test(answer)
  return /没有.*(上下文|站内|资料|信息)|缺少.*(上下文|资料|信息)|不足.*(上下文|资料|信息)|无法检索|检索限制|暂时没有资料/.test(answer)
}

function buildSmallTalkAnswer(message: string, identityIntent: IdentityIntent, isEn: boolean): string {
  if (isEn) {
    const text = message.trim().toLowerCase()
    if (identityIntent === "assistant") {
      return "I am the site assistant. I answer based on public site content and help visitors understand the site owner faster."
    }
    if (identityIntent === "owner") {
      return "If you want to learn about the site owner, I can summarize their works, posts, tutorials, and about page. You can ask: which works to start with, what project types they excel at, or how to contact for collaboration."
    }
    if (text.includes("what can you do")) {
      return "I can help you quickly understand the site owner and their public content, such as key works, strengths, tutorial topics, and collaboration details, with source links when available."
    }
    return "Hi, you can ask about the site owner's works, experience, tutorials, or collaboration details, and I will answer based on site content."
  }

  const text = message.trim().toLowerCase()
  if (identityIntent === "assistant") {
    return "我是站点助手，负责基于站内公开内容回答问题，并帮访客更快了解站点主人。"
  }
  if (identityIntent === "owner") {
    return "如果你想了解站点主人，我可以从作品、文章、教程和关于页里帮你快速总结。你可以直接问：有哪些代表作品、擅长什么类型项目、如何联系合作。"
  }
  if (text.includes("能做什么") || text.includes("会什么")) {
    return "我可以帮你快速了解站点主人及其公开内容，比如代表作品、擅长项目、教程方向和合作方式。我会尽量附上对应来源。"
  }
  return "你好，你可以直接问我关于站点主人的作品、经验、教程或合作方式的问题，我会按站内内容来回答。"
}

function sourceTypeLabel(type: Citation["sourceType"], isEn = false): string {
  if (type === "POST") return isEn ? "Post" : "文章"
  if (type === "WORK") return isEn ? "Work" : "作品"
  if (type === "TUTORIAL") return isEn ? "Tutorial" : "教程"
  return isEn ? "Site" : "站点信息"
}

function isProfileIntentMessage(input: string): boolean {
  const text = input.trim().toLowerCase()
  if (!text) return false
  return /(擅长|类型项目|代表作品|合作|联系|服务|接项目|能做什么项目|做什么项目)/.test(text)
}

function enrichQueryTokens(message: string, tokens: string[]): string[] {
  const text = message.trim().toLowerCase()
  const set = new Set(tokens)
  if (/(擅长|类型项目|做什么项目)/.test(text)) {
    ;["擅长", "项目", "作品", "设计", "开发", "服务"].forEach((t) => set.add(t))
  }
  if (/(代表作品|作品)/.test(text)) {
    ;["作品", "案例", "项目", "教程"].forEach((t) => set.add(t))
  }
  if (/(合作|联系)/.test(text)) {
    ;["合作", "联系", "邮箱", "about"].forEach((t) => set.add(t))
  }
  if (/(开发作品|设计作品|设计组件|设计文件|组件库)/.test(text)) {
    ;["开发", "设计", "作品", "组件", "组件库", "设计文件"].forEach((t) => set.add(t))
  }
  if (/(最近|最新|更新)/.test(text)) {
    ;["最近", "最新", "更新", "文章", "课程", "内容"].forEach((t) => set.add(t))
  }
  return Array.from(set).slice(0, 18)
}

const QUERY_STOP_WORDS = new Set([
  "一个",
  "一下",
  "什么",
  "哪些",
  "怎么",
  "如何",
  "可以",
  "目前",
  "现在",
  "这个",
  "那个",
  "以及",
  "还有",
  "have",
  "what",
  "which",
  "with",
  "about",
])

function segmentQueryWords(query: string): string[] {
  try {
    const locale = /[\u3400-\u9fff]/.test(query) ? "zh" : "en"
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" })
    return Array.from(segmenter.segment(query))
      .filter((item) => item.isWordLike)
      .map((item) => item.segment.trim().toLowerCase())
      .filter((item) => item.length >= 2 && !QUERY_STOP_WORDS.has(item))
  } catch {
    return []
  }
}

function buildQueryTokens(query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const parts = q
    .split(/[\s,，。！？?、;；:：/\\()[\]{}"'“”‘’<>《》【】]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
  const segmented = segmentQueryWords(q)
  const set = new Set<string>([q, ...parts, ...segmented])
  return Array.from(set).slice(0, 18)
}

function resolveReferenceLimits(message: string): { maxCitations: number } {
  const text = message.trim()
  if (!text) return { maxCitations: 1 }
  const askMultiple =
    /(3|三|几个|哪些|有哪些|推荐|列举|清单|合集|分别|对比|比较|Top|top|全部|更多)/.test(text) ||
    /(作品|案例|项目).*(推荐|列表|清单|合集)/.test(text) ||
    /(what|which).*(works|projects|cases|design files|components|posts|articles|courses|content)/i.test(text)
  if (askMultiple) return { maxCitations: 3 }
  return { maxCitations: 1 }
}

function rerankCitationsByAnswer(
  answer: string,
  message: string,
  citations: Citation[],
  maxCitations: number,
): Citation[] {
  if (citations.length <= 1) return citations.slice(0, maxCitations)
  const tokens = enrichQueryTokens(`${message} ${answer}`, buildQueryTokens(`${message} ${answer}`))
  const scored = citations.map((citation, index) => {
    const text = `${citation.title} ${citation.snippet}`.toLowerCase()
    let score = 0
    for (const token of tokens) {
      if (!token) continue
      if (text.includes(token.toLowerCase())) score += 1
    }
    const titleHit = answer.includes(citation.title)
    if (titleHit) score += 3
    return { citation, index, score, titleHit }
  })
  const sorted = scored.sort((a, b) => b.score - a.score || a.index - b.index)
  const filtered = sorted.filter((item) => item.titleHit || item.score >= 2)
  if (filtered.length > 0) return filtered.slice(0, maxCitations).map((item) => item.citation)
  return sorted.slice(0, 1).map((item) => item.citation)
}

function keepWorkCitations(citations: Citation[], maxCitations: number): Citation[] {
  return citations.filter((item) => item.sourceType === "WORK").slice(0, maxCitations)
}

function limitCitations(citations: Citation[], maxCitations: number): Citation[] {
  return citations
    .filter((item, index, list) => list.findIndex((v) => v.url === item.url) === index)
    .slice(0, maxCitations)
}

function normalizeLinkLabel(value: string): string {
  return value.toLowerCase().replace(/[\s·：:｜|—–-]+/g, "")
}

function constrainAnswerLinks(answer: string, citations: Citation[]): string {
  if (!answer.includes("](")) return answer
  return answer.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, rawLabel: string, rawUrl: string) => {
    const label = rawLabel.trim()
    const url = rawUrl.trim()
    let pathname = url
    if (/^https?:\/\//i.test(url)) {
      try {
        pathname = new URL(url).pathname
      } catch {
        pathname = ""
      }
    }
    const normalizedLabel = normalizeLinkLabel(label)
    const matched = citations.find((citation) => {
      const citationLabel = normalizeLinkLabel(citation.title)
      return citation.url === url
        || citation.url === pathname
        || normalizedLabel.includes(citationLabel)
        || citationLabel.includes(normalizedLabel)
    })
    return matched ? `[${label}](${matched.url})` : label
  })
}

function isWorkShowcaseIntent(message: string, isEn: boolean): boolean {
  const text = message.trim()
  if (!text) return false
  if (isEn) {
    return /(representative|featured|best|top|worth seeing|start with).*(work|works|project|projects|case|cases)/i.test(text)
      || /(work|works|project|projects|case|cases).*(representative|featured|best|top|worth seeing)/i.test(text)
      || /(what|which).*(development works|design files|design components|works)/i.test(text)
  }
  return /(代表作品|作品|案例|项目).*(3|三|推荐|先看|最值得看|精选|最好)/.test(text)
    || /(先给我|先看|推荐).*(作品|案例|项目)/.test(text)
    || /(有哪些|哪些).*(开发作品|设计作品|设计组件|设计文件|组件库|作品)/.test(text)
}

function isPostCollectionIntent(message: string, isEn: boolean): boolean {
  const text = message.trim()
  if (!text) return false
  if (isEn) {
    return /(latest|recent|updated|new).*(posts|articles|courses|content)/i.test(text)
      || /(what|which).*(posts|articles|courses).*(available|published|updated)/i.test(text)
  }
  return /(最近|最新|更新).*(文章|课程|内容)/.test(text)
    || /(有哪些|哪些).*(文章|课程)/.test(text)
}

function scoreText(text: string, tokens: string[]): number {
  if (!tokens.length) return 0
  const lower = text.toLowerCase()
  let score = 0
  for (const t of tokens) {
    if (lower.includes(t)) score += t.length > 8 ? 2 : 1
  }
  return score
}

function makeSnippet(text: string, tokens: string[]): string {
  const clean = htmlToPlainText(text).replace(/\s+/g, " ").trim()
  if (!clean) return ""
  const lower = clean.toLowerCase()
  let index = -1
  for (const t of tokens) {
    const i = lower.indexOf(t)
    if (i >= 0) {
      index = i
      break
    }
  }
  if (index < 0) {
    const end = clean.search(/[。！？!?]/)
    return end >= 0 ? clean.slice(0, end + 1) : clean.slice(0, 280)
  }
  let start = Math.max(0, index - 40)
  const prevStop = Math.max(
    clean.lastIndexOf("。", index),
    clean.lastIndexOf("！", index),
    clean.lastIndexOf("？", index),
    clean.lastIndexOf("!", index),
    clean.lastIndexOf("?", index),
  )
  if (prevStop >= 0) start = prevStop + 1
  let end = Math.min(clean.length, start + 280)
  const nextStop = clean.slice(end).search(/[。！？!?]/)
  if (nextStop >= 0) end = Math.min(clean.length, end + nextStop + 1)
  return clean.slice(start, end).trim()
}

function normalizeSnippetForDisplay(text: string): string {
  return htmlToPlainText(text)
    .replace(/\s+/g, " ")
    .replace(/[；;]{2,}/g, "；")
    .replace(/[。\.]{2,}/g, "。")
    .replace(/[\[\]{}]/g, "")
    .trim()
}

function toReadablePoint(text: string): string {
  const compact = normalizeSnippetForDisplay(text)
  if (!compact) return ""
  const segments = compact
    .split(/[。！？；;\n]/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const candidate =
    segments.find((s) => /[\u4e00-\u9fa5]/.test(s) && s.length >= 10 && !/[{}[\]|]/.test(s)) ||
    segments.find((s) => s.length >= 8) ||
    compact
  return candidate
}

function normalizeLink(url: string): string {
  const text = (url || "").trim()
  if (!text) return "/about"
  if (/^https?:\/\//i.test(text)) return text
  return text.startsWith("/") ? text : `/${text}`
}

function localizeInternalUrl(url: string, locale: "zh" | "en"): string {
  const normalized = normalizeLink(url)
  if (locale !== "en" || /^https?:\/\//i.test(normalized) || normalized.startsWith("/en/")) return normalized
  return `/en${normalized}`
}

function localizedSlug(raw: unknown, locale: "zh" | "en", fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback
  const value = (raw as Record<string, unknown>)[locale]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function pickManualSourceUrl(item: AIAssistantManualKnowledge): string {
  const first = Array.isArray(item.sourceUrls) ? item.sourceUrls.find((u) => typeof u === "string" && u.trim()) : ""
  return normalizeLink(first || "/about")
}

function scoreManualKnowledge(item: AIAssistantManualKnowledge, message: string): number {
  const text = message.trim().toLowerCase()
  if (!text) return 0
  const question = item.question.toLowerCase()
  const title = item.title.toLowerCase()
  let score = 0
  if (text === question) score += 6
  if (question.includes(text) || text.includes(question)) score += 3
  if (title && (text.includes(title) || title.includes(text))) score += 2
  for (const keyword of item.keywords) {
    const token = keyword.toLowerCase()
    if (!token) continue
    if (text.includes(token)) score += 1.5
  }
  return score
}

function pickManualKnowledgeHit(
  items: AIAssistantManualKnowledge[],
  message: string,
  options?: { maxLength?: number; minScore?: number },
): AIAssistantManualKnowledge | null {
  const text = message.trim()
  const maxLength = options?.maxLength ?? 40
  const minScore = options?.minScore ?? 5
  if (text.length > maxLength) return null
  const ranked = items
    .map((item) => ({ item, score: scoreManualKnowledge(item, text) }))
    .sort((a, b) => b.score - a.score || a.item.sortOrder - b.item.sortOrder)
  const best = ranked[0]
  // Keep manual direct answer for high-confidence matches only.
  // This avoids hijacking general questions that should go through retrieval/model.
  if (!best || best.score < minScore) return null
  return best.item
}

function pickManualKnowledgeById(items: AIAssistantManualKnowledge[], id: string): AIAssistantManualKnowledge | null {
  const normalized = id.trim()
  if (!normalized) return null
  return items.find((item) => item.id === normalized) ?? null
}

function manualToCitation(item: AIAssistantManualKnowledge): Citation {
  return {
    title: item.title || item.question,
    url: pickManualSourceUrl(item),
    snippet: item.answer,
    sourceType: "SETTINGS",
  }
}

function normalizeHistory(raw: unknown): AIChatMessage[] {
  if (!Array.isArray(raw)) return []
  const safe: AIChatMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const role = (item as { role?: string }).role
    const content = (item as { content?: string }).content
    if (!content || typeof content !== "string") continue
    if (role !== "user" && role !== "assistant") continue
    safe.push({ role, content: content.slice(0, 2000) })
  }
  return safe.slice(-8)
}

function parseEmbedding(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const list: number[] = []
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item)) list.push(item)
    else return null
  }
  return list
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function manualKnowledgeToCandidates(items: AIAssistantManualKnowledge[]): Candidate[] {
  return items
    .filter((item) => item.enabled)
    .map((item) => ({
      title: item.title || item.question,
      url: pickManualSourceUrl(item),
      sourceType: "SETTINGS" as const,
      text: [item.question, item.answer, item.keywords.join(" ")].filter(Boolean).join("\n"),
      updatedAt: new Date(0),
      embeddings: [],
    }))
}

async function buildAboutCandidate(locale: "zh" | "en"): Promise<Candidate | null> {
  const settings = await prisma.settings.findUnique({
    where: { id: "settings" },
    select: { about: true, updatedAt: true },
  })
  if (!settings) return null
  const about = normalizeAboutModules(settings.about as Parameters<typeof normalizeAboutModules>[0])
  const aboutText = [
    about.intro,
    ...(about.workExperience ?? []).map((item) => [item.company, item.role, item.period, item.description].filter(Boolean).join(" ")),
    ...(about.education ?? []).map((item) => [item.school, item.degree, item.period].filter(Boolean).join(" ")),
    ...(about.skills ?? []).map((item) => [item.name, item.level].filter(Boolean).join(" ")),
  ]
    .filter(Boolean)
    .join("\n")
  if (!aboutText.trim()) return null
  return {
    title: locale === "en" ? "About" : "关于我",
    url: locale === "en" ? "/en/about" : "/about",
    sourceType: "SETTINGS",
    text: aboutText,
    updatedAt: settings.updatedAt,
    embeddings: [],
  }
}

async function buildCandidates(
  manualKnowledge: AIAssistantManualKnowledge[] = [],
  retrievalSources: AIAssistantRetrievalSources = defaultAIAssistantConfig.retrievalSources,
  locale: "zh" | "en" = "zh",
): Promise<Candidate[]> {
  const manualCandidates = retrievalSources.manualKnowledge ? manualKnowledgeToCandidates(manualKnowledge) : []
  const knowledgeSourceModel = (prisma as unknown as {
    knowledgeSource?: {
      findMany: (args: unknown) => Promise<Array<{
        title: string
        url: string
        sourceType: string
        updatedAt: Date
        chunks: Array<{ contentText: string; embedding: unknown }>
      }>>
    }
  }).knowledgeSource

  const indexedSourcesRaw =
    knowledgeSourceModel && typeof knowledgeSourceModel.findMany === "function"
      ? await knowledgeSourceModel
          .findMany({
            where: { status: "ACTIVE" },
            include: {
              chunks: {
                orderBy: { chunkIndex: "asc" },
                take: 20,
              },
            },
            orderBy: { updatedAt: "desc" },
            take: 240,
          })
          .catch(() => [])
      : []
  const indexedSources = indexedSourcesRaw.filter((source) => {
    if (source.sourceType === "POST") return retrievalSources.posts
    if (source.sourceType === "WORK") return retrievalSources.works
    if (source.sourceType === "TUTORIAL") return retrievalSources.tutorials
    if (source.sourceType === "SETTINGS") return false
    return true
  })

  if (indexedSources.length > 0) {
    const base = indexedSources.map((source) => ({
      title: source.title,
      url: localizeInternalUrl(source.url, locale),
      sourceType: source.sourceType as Citation["sourceType"],
      text: source.chunks.map((c) => c.contentText).join("\n"),
      updatedAt: source.updatedAt,
      embeddings: source.chunks.map((c) => parseEmbedding(c.embedding)).filter((v): v is number[] => Array.isArray(v)),
    }))
    const aboutCandidate = retrievalSources.about ? await buildAboutCandidate(locale) : null
    return [...manualCandidates, ...(aboutCandidate ? [aboutCandidate] : []), ...base]
  }

  const [posts, works, tutorials] = await Promise.all([
    retrievalSources.posts ? prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        title: true,
        slug: true,
        slugI18n: true,
        excerpt: true,
        content: true,
        coverImage: true,
        updatedAt: true,
        category: { select: { name: true } },
        tags: { select: { name: true } },
      },
      take: 120,
    }) : Promise.resolve([]),
    retrievalSources.works ? prisma.work.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        title: true,
        slug: true,
        workType: true,
        description: true,
        content: true,
        updatedAt: true,
        category: { select: { name: true } },
        tags: { select: { name: true } },
      },
      take: 120,
    }) : Promise.resolve([]),
    retrievalSources.tutorials ? prisma.videoTutorial.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        title: true,
        slug: true,
        description: true,
        updatedAt: true,
        category: { select: { name: true } },
        tags: { select: { name: true } },
      },
      take: 120,
    }) : Promise.resolve([]),
  ])

  const candidates: Candidate[] = []

  for (const p of posts) {
    const excerptText = htmlToPlainText(p.excerpt)
    const body = jsonToPlainText(p.content)
    const tags = (p.tags ?? []).map((t) => t.name).join(" ")
    const category = p.category?.name ?? ""
    const text = [p.title, category, tags, excerptText, body].filter(Boolean).join("\n")
    candidates.push({
      title: p.title,
      url: localizeInternalUrl(`/blog/${localizedSlug(p.slugI18n, locale, p.slug)}`, locale),
      sourceType: "POST",
      text,
      updatedAt: p.updatedAt,
      embeddings: [],
    })
  }

  for (const w of works) {
    const contentText = jsonToPlainText(w.content)
    const tags = (w.tags ?? []).map((t) => t.name).join(" ")
    const category = w.category?.name ?? ""
    const workTypeLabel = w.workType === "DEVELOPMENT" ? "开发作品" : "设计作品"
    const text = [w.title, workTypeLabel, category, tags, w.description ?? "", contentText].filter(Boolean).join("\n")
    candidates.push({
      title: w.title,
      url: localizeInternalUrl(`/works/${w.slug}`, locale),
      sourceType: "WORK",
      text,
      updatedAt: w.updatedAt,
      embeddings: [],
    })
  }

  for (const t of tutorials) {
    const tags = (t.tags ?? []).map((tag) => tag.name).join(" ")
    const category = t.category?.name ?? ""
    const text = [t.title, category, tags, t.description ?? ""].filter(Boolean).join("\n")
    candidates.push({
      title: t.title,
      url: localizeInternalUrl(`/tutorials#${t.slug}`, locale),
      sourceType: "TUTORIAL",
      text,
      updatedAt: t.updatedAt,
      embeddings: [],
    })
  }

  const aboutCandidate = retrievalSources.about ? await buildAboutCandidate(locale) : null
  return [...manualCandidates, ...(aboutCandidate ? [aboutCandidate] : []), ...candidates]
}

async function rankCandidates(
  message: string,
  tokens: string[],
  candidates: Candidate[],
  configured: boolean,
  providerConfig?: AIProviderConfig,
) {
  let queryEmbedding: number[] | null = null
  const hasVectorData = candidates.some((c) => c.embeddings.length > 0)

  if (configured && hasVectorData) {
    try {
      const provider = createAIProvider(providerConfig)
      const vectors = await provider.embed?.({ texts: [message] })
      queryEmbedding = vectors?.[0] ?? null
    } catch (e) {
      console.error("[/api/ai/chat] embed query failed:", e)
    }
  }

  return candidates
    .map((candidate) => {
      const keywordScore = scoreText(`${candidate.title}\n${candidate.text}`, tokens)
      const vectorScore =
        queryEmbedding && candidate.embeddings.length > 0
          ? Math.max(...candidate.embeddings.map((vec) => cosineSimilarity(queryEmbedding as number[], vec)))
          : 0
      const finalScore = keywordScore + Math.max(0, vectorScore) * 5
      return { candidate, score: finalScore }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.candidate.updatedAt.getTime() - a.candidate.updatedAt.getTime()
    })
}

function shouldShowEvidence(ranked: Array<{ score: number }>): boolean {
  const topScore = ranked[0]?.score ?? 0
  const top3 = ranked.slice(0, 3)
  const avgTop3 = top3.length > 0 ? top3.reduce((sum, item) => sum + item.score, 0) / top3.length : 0
  return topScore >= CITATION_TOP_SCORE_THRESHOLD && avgTop3 >= CITATION_AVG_TOP3_THRESHOLD
}

function splitTextChunks(text: string, size = 14): string[] {
  if (!text) return []
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}

function shortPoint(text: string, max = 48): string {
  const p = toReadablePoint(text).replace(/\s+/g, " ").trim()
  if (!p) return ""
  return p.length > max ? `${p.slice(0, max)}…` : p
}

function buildRetrievalAnswer(message: string, citations: Citation[], identityIntent: IdentityIntent, isEn: boolean): string {
  if (isEn) {
    const normalized = message.trim()
    if (!normalized) return "I can answer based on public site content."
    const askWorks = /(work|works|project|projects|case|cases).*(3|three)|start.*(work|project)|best/.test(normalized.toLowerCase())
    if (identityIntent === "owner" && citations.length > 0) {
      const top = citations.slice(0, 2).map((c) => shortPoint(c.snippet, 52)).filter(Boolean)
      if (top.length > 0) {
        const joined = top.join("; ")
        return `Based on public site information, here is a quick overview: ${joined}. I can also expand on representative works or collaboration details.`
      }
    }
    if (citations.length === 0) {
      return "I could not find enough relevant site content yet. Try a more specific question, such as which representative works to start with or how to contact for collaboration."
    }
    const compact = citations.map((c) => ({
      title: c.title,
      point: shortPoint(c.snippet, 56),
      type: c.sourceType,
    }))
    if (compact.every((c) => !c.point)) {
      return "I found relevant content. You can open the source links below, and I can also summarize key points."
    }
    if (askWorks) {
      const workFirst = [...compact].sort((a, b) => (a.type === "WORK" ? -1 : 1) - (b.type === "WORK" ? -1 : 1))
      const items = workFirst
        .slice(0, 3)
        .map((item) => `${item.title}: ${item.point || "open the source link below for details"}`)
        .join("; ")
      return `You can start with these directions: ${items}.`
    }
    const lead = compact[0]?.point || "I found relevant site content."
    const support = compact
      .slice(1, 3)
      .map((item) => item.point)
      .filter(Boolean)
      .join("; ")
    if (support) {
      return `Based on site content, here is a concise answer: ${lead}. Additional context: ${support}.`
    }
    return `Based on site content, here is a concise answer: ${lead}`
  }

  const normalized = message.trim()
  if (!normalized) return "我可以基于站内公开内容帮你解答问题。"
  const askWorks = /(代表作品|作品|案例|项目).*(3|三)|先看.*(作品|案例)|最值得看/.test(normalized)
  if (identityIntent === "owner" && citations.length > 0) {
    const top = citations.slice(0, 2).map((c) => shortPoint(c.snippet, 52)).filter(Boolean)
    if (top.length > 0) {
      const joined = top.join("；")
      return `基于站内公开信息，先给你一个简要介绍：${joined}。如果你希望，我可以继续展开代表作品或合作方式。`
    }
  }
  if (citations.length === 0) {
    return "我暂时没有检索到足够相关的站内内容。你可以换个更具体的问法，比如“有哪些代表作品可先看”或“如何联系合作”。"
  }
  const compact = citations.map((c) => ({
    title: c.title,
    point: shortPoint(c.snippet, 56),
    type: c.sourceType,
  }))
  if (compact.every((c) => !c.point)) {
    return "我已找到相关站内内容，你可以先查看下方来源链接，我也可以继续帮你总结重点。"
  }

  if (askWorks) {
    const workFirst = [...compact].sort((a, b) => (a.type === "WORK" ? -1 : 1) - (b.type === "WORK" ? -1 : 1))
    const items = workFirst
      .slice(0, 3)
      .map((item) => `${item.title}：${item.point || "可从下方来源查看详情"}`)
      .join("；")
    return `推荐你先看这些方向：${items}。`
  }

  const lead = compact[0]?.point || "已找到相关站内内容。"
  const support = compact
    .slice(1, 3)
    .map((item) => item.point)
    .filter(Boolean)
    .join("；")
  if (support) {
    return `基于站内内容，先给你简要结论：${lead}。补充信息：${support}。`
  }
  return `基于站内内容，先给你简要结论：${lead}`
}

function shouldUseModel(configured: boolean): boolean {
  // Prefer the model whenever it is available. Manual knowledge has already
  // been handled above; model prompting still constrains site-specific facts.
  return configured
}

function sanitizeAnswerOutput(answer: string): string {
  if (!answer) return ""
  return htmlToPlainTextWithBreaks(answer)
    .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 $2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)、])\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s*>+\s?/gm, "")
    .replace(/sk-[a-zA-Z0-9_-]{16,}/g, "[已脱敏密钥]")
    .replace(/(api[\s_-]?key|access[\s_-]?token)\s*[:=]\s*[^\s,;]+/gi, "$1: [已脱敏]")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function buildSSE(payload: ChatPayload): NextResponse {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

      ;(async () => {
        send({
          type: "meta",
          sessionId: payload.sessionId,
          citations: payload.citations,
          confidence: payload.confidence,
        })

        for (const step of payload.trace) {
          send({ type: "progress", text: step })
          await sleep(120)
        }

        for (const chunk of splitTextChunks(payload.answer)) {
          send({ type: "delta", text: chunk })
          await sleep(16)
        }

        send({ type: "done" })
        controller.close()
      })().catch(() => {
        controller.close()
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const locale = body?.locale === "en" ? "en" : "zh"
    let assistantConfig = defaultAIAssistantConfig
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: "settings" },
        select: { aiAssistant: true, aiAssistantI18n: true },
      })
      const aiAssistantI18n =
        settings?.aiAssistantI18n && typeof settings.aiAssistantI18n === "object"
          ? (settings.aiAssistantI18n as Record<string, unknown>)
          : null
      const localizedAssistant = aiAssistantI18n?.[locale] ?? settings?.aiAssistant
      assistantConfig = normalizeAIAssistantConfig(localizedAssistant)
    } catch {
      assistantConfig = { ...defaultAIAssistantConfig }
    }
    const guardrails = assistantConfig.guardrails || {
      maxRequestsPerMinute: DEFAULT_RATE_LIMIT_MAX_REQUESTS,
      maxQuestionLength: DEFAULT_MAX_MESSAGE_LENGTH,
      cacheTtlSeconds: DEFAULT_CACHE_TTL_SECONDS,
      dailyTokenBudget: DEFAULT_DAILY_TOKEN_BUDGET,
      strictInputSafety: true,
    }
    const cacheTtlMs = Math.max(30, guardrails.cacheTtlSeconds) * 1000
    const ip = getClientIp(request)
    const message = typeof body?.message === "string" ? body.message.trim() : ""
    const isEn = locale === "en"
    const t = (zh: string, en: string) => (isEn ? en : zh)
    const listSep = isEn ? "; " : "；"
    const referenceLimits = resolveReferenceLimits(message)
    const unsafeReason = detectUnsafeMessage(message, guardrails.maxQuestionLength, guardrails.strictInputSafety, isEn)
    if (unsafeReason) {
      return NextResponse.json({ error: unsafeReason }, { status: 400 })
    }
    const limit = checkRateLimit(ip, guardrails.maxRequestsPerMinute)
    if (!limit.ok) {
      return NextResponse.json(
        { error: t("提问过于频繁，请稍后再试。", "Too many requests. Please try again shortly."), retryAfter: limit.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      )
    }

    const bodyOptions = body?.options && typeof body.options === "object" ? (body.options as Record<string, unknown>) : {}
    const streamWanted = bodyOptions.stream === true
    const selectedKnowledgeId = typeof bodyOptions.knowledgeId === "string" ? bodyOptions.knowledgeId.trim() : ""
    const preferPresetAnswer = bodyOptions.preferPreset === true
    const modelId = typeof body?.modelId === "string" ? body.modelId : "default"
    const cacheKey = `${modelId}::${locale}::${selectedKnowledgeId || "free"}::${normalizeCacheKey(message)}`
    const cached = readCache(cacheKey)
    if (cached) {
      const payload: ChatPayload = {
        ...cached,
        citations: limitCitations(cached.citations || [], referenceLimits.maxCitations),
        sessionId: body?.sessionId || null,
        trace: [...cached.trace, t(`命中缓存：已复用近 ${Math.max(1, Math.floor(guardrails.cacheTtlSeconds / 60))} 分钟内回答`, `Cache hit: reused an answer from about the last ${Math.max(1, Math.floor(guardrails.cacheTtlSeconds / 60))} minutes`)],
      }
      if (streamWanted) return buildSSE(payload)
      return NextResponse.json(payload)
    }

    const resolved = await resolveAIConfig({
      modelId: typeof body?.modelId === "string" ? body.modelId : null,
    })
    const config = resolved.providerConfig
    const configured = resolved.configured
    if (!message) {
      return NextResponse.json({ error: t("message required", "message required") }, { status: 400 })
    }

    const history = normalizeHistory(body?.history)
    const identityIntent = detectIdentityIntent(message)
    const isSmallTalk = isSmallTalkMessage(message) && identityIntent !== "owner"
    const isCapabilityQuestion = isCapabilityQuestionMessage(message)
    const workShowcaseIntent = isWorkShowcaseIntent(message, isEn)
    const baseTokens = buildQueryTokens(message)
    const tokens = enrichQueryTokens(message, baseTokens)
    const manualKnowledge = (assistantConfig.manualKnowledge || []).filter((item) => item.enabled)
    const retrievalSources = assistantConfig.retrievalSources || defaultAIAssistantConfig.retrievalSources
    const manualKnowledgeMode: AIAssistantManualKnowledgeMode = assistantConfig.manualKnowledgeMode || "recommend_only"
    const exactManualHit = selectedKnowledgeId ? pickManualKnowledgeById(manualKnowledge, selectedKnowledgeId) : null
    const allowManualDirect =
      manualKnowledgeMode === "direct_answer" ||
      manualKnowledgeMode === "hybrid" ||
      preferPresetAnswer ||
      Boolean(exactManualHit)
    const manualHit =
      exactManualHit ||
      (allowManualDirect && !isSmallTalk && identityIntent !== "assistant"
        ? pickManualKnowledgeHit(manualKnowledge, message, {
            minScore: preferPresetAnswer ? 5 : 7,
            maxLength: 36,
          })
        : null
      )

    if (manualHit) {
      const rankedForLinks = await rankCandidates(
        message,
        tokens,
        await buildCandidates(manualKnowledge, retrievalSources, locale),
        configured,
        config,
      )
      const extraPool = rankedForLinks.filter((item) => item.candidate.sourceType === "WORK")
      const manualCitation = manualToCitation(manualHit)
      const extraLimit = Math.max(0, referenceLimits.maxCitations - 1)
      const thresholdHit = extraPool.filter((item) => item.score >= CITATION_ITEM_SCORE_THRESHOLD).slice(0, extraLimit)
      const extraRanked = thresholdHit.length > 0 ? thresholdHit : extraPool.slice(0, extraLimit)
      const extraCitations: Citation[] = extraRanked.map((item) => ({
        title: item.candidate.title,
        url: item.candidate.url,
        snippet: makeSnippet(item.candidate.text, tokens),
        sourceType: item.candidate.sourceType,
      }))
      const citations = [manualCitation, ...extraCitations]
        .filter((item, index, list) => list.findIndex((v) => v.url === item.url) === index)
        .slice(0, referenceLimits.maxCitations)
      const trace = [
        `${t("问题理解", "Question understood")}: ${message}`,
        t("路由决策：人工知识优先匹配", "Routing: prioritized manual knowledge"),
        `${t("命中人工知识", "Matched manual knowledge")}: ${manualHit.title || manualHit.question}`,
        citations.length > 1
          ? `${t("补充引用", "Additional references")}: ${citations
              .slice(0, 3)
              .map((c) => `[${sourceTypeLabel(c.sourceType, isEn)}] ${c.title}`)
              .join(listSep)}`
          : `${t("补充引用", "Additional references")}: ${t("无", "None")}`,
        t("路由结果：规则直答（人工知识）", "Route result: rule-based direct answer (manual knowledge)"),
        t("正在生成回答…", "Generating answer..."),
      ]
      const payload: ChatPayload = {
        sessionId: body?.sessionId || null,
        answer: sanitizeAnswerOutput(manualHit.answer),
        citations,
        confidence: 0.95,
        trace,
      }
      writeCache(cacheKey, { ...payload, sessionId: null }, cacheTtlMs)
      if (streamWanted) return buildSSE(payload)
      return NextResponse.json(payload)
    }

    const isProfileIntent = identityIntent === "owner" || isProfileIntentMessage(message)
    const candidates = await buildCandidates(manualKnowledge, retrievalSources, locale)
    const rankedAll = await rankCandidates(message, tokens, candidates, configured, config)
    const postCollectionIntent = isPostCollectionIntent(message, isEn)
    const ranked =
      workShowcaseIntent && rankedAll.some((item) => item.candidate.sourceType === "WORK")
        ? rankedAll.filter((item) => item.candidate.sourceType === "WORK")
        : postCollectionIntent && rankedAll.some((item) => item.candidate.sourceType === "POST")
          ? rankedAll.filter((item) => item.candidate.sourceType === "POST")
        : rankedAll

    const collectionIntent = workShowcaseIntent || postCollectionIntent
    const showEvidence = !isSmallTalk && (collectionIntent || isProfileIntent || shouldShowEvidence(ranked))
    const hasWeakEvidence = !isSmallTalk && !showEvidence && (ranked[0]?.score ?? 0) > HARD_BLOCK_SCORE_THRESHOLD
    const selectedByThreshold = ranked
      .filter((item) => item.score >= CITATION_ITEM_SCORE_THRESHOLD)
      .slice(0, Math.max(3, referenceLimits.maxCitations))
    const selectedRanked = showEvidence
      ? (collectionIntent
          ? ranked.slice(0, referenceLimits.maxCitations)
          : selectedByThreshold.length > 0
            ? selectedByThreshold.slice(0, referenceLimits.maxCitations)
            : ranked.slice(0, referenceLimits.maxCitations))
      : hasWeakEvidence
        ? ranked.slice(0, 2)
        : []
    let citations: Citation[] = selectedRanked.map((item) => ({
      title: item.candidate.title,
      url: item.candidate.url,
      snippet: makeSnippet(item.candidate.text, tokens),
      sourceType: item.candidate.sourceType,
    }))
    const context = citations
      .map((c, index) => `#${index + 1} [${c.sourceType}] ${c.title}\nURL: ${c.url}\n${c.snippet}`)
      .join("\n\n")

    const rankedPreview = ranked.slice(0, 3)
    const trace: string[] = [
      `${t("问题理解", "Question understood")}: ${message}`,
      t("路由决策：分析提问类型与证据强度", "Routing: analyzing intent and evidence strength"),
      `${t("检索词", "Retrieval tokens")}: ${tokens.slice(0, 10).join(isEn ? ", " : "、") || t("无", "None")}`,
      rankedPreview.length > 0
        ? `${t("候选命中", "Candidate hits")}: ${rankedPreview
            .map((item) => `[${sourceTypeLabel(item.candidate.sourceType, isEn)}] ${item.candidate.title} (${item.score.toFixed(2)})`)
            .join(listSep)}`
        : `${t("候选命中", "Candidate hits")}: ${t("无", "None")}`,
      citations.length > 0
        ? `${t("已采用来源", "Adopted sources")}: ${citations
            .slice(0, 3)
            .map((c) => `[${sourceTypeLabel(c.sourceType, isEn)}] ${c.title}`)
            .join(listSep)}`
        : `${t("已采用来源", "Adopted sources")}: ${t("无", "None")}`,
    ]

    let answer = ""
    let routeMode: RouteMode =
      shouldUseModel(configured)
          ? "model"
          : isSmallTalk || identityIntent === "assistant"
            ? "rule"
            : "retrieval"
    if (routeMode === "model") {
      const estimatedPromptTokens =
        estimateTokenCount(message) +
        estimateTokenCount(context) +
        history.reduce((sum, item) => sum + estimateTokenCount(item.content), 0)
      const reserved = reserveDailyTokenBudget(estimatedPromptTokens + 700, guardrails.dailyTokenBudget)
      if (!reserved.ok) {
        routeMode = "retrieval"
        trace.push(t(`预算闸门：今日模型预算不足（剩余约 ${reserved.remaining} tokens），自动降级为检索直答`, `Budget gate: today's model budget is low (about ${reserved.remaining} tokens left), downgraded to retrieval answer`))
      } else {
        trace.push(t(`预算闸门：今日预算可用（已用 ${reserved.used}/${reserved.limit}）`, `Budget gate: budget available today (used ${reserved.used}/${reserved.limit})`))
      }
    }
    trace.push(
      `${t("路由结果", "Route result")}: ${
        routeMode === "rule"
          ? t("规则直答", "Rule-based direct answer")
          : routeMode === "retrieval"
            ? t("检索直答", "Retrieval answer")
            : t("大模型生成", "Model-generated answer")
      }`,
    )
    trace.push(t("正在生成回答…", "Generating answer..."))

    if (!configured) {
      answer =
        routeMode === "rule"
          ? buildSmallTalkAnswer(message, identityIntent, isEn)
          : citations.length > 0
          ? buildRetrievalAnswer(message, citations, identityIntent, isEn)
          : t("我暂时没有检索到足够依据来回答这个问题。你可以换个问法，或先查看相关页面。", "I do not have enough evidence from site content to answer this yet. Try rephrasing your question or check the related pages first.")
    } else {
      if (routeMode === "rule") {
        answer = buildSmallTalkAnswer(message, identityIntent, isEn)
      } else if (routeMode === "retrieval") {
        answer = buildRetrievalAnswer(message, citations, identityIntent, isEn)
      } else {
        const provider = createAIProvider(config)
        const promptMessages: AIChatMessage[] = [
          {
            role: "system",
            content: isEn
              ? "You are the AI assistant for a personal website frontend. You may answer safe general questions, casual chat, and questions about what you can do. When the user asks about what you can answer, describe your capabilities directly. Do not mention missing context, missing site details, or retrieval limits in capability answers. When the user asks about the site owner, works, courses, collaboration, or other site-specific facts, use the provided on-site context first and do not invent facts. If no on-site context is provided for a site-specific factual question, say what you can answer generally and invite a more specific question. If the user asks 'who are you' or asks about 'yourself', default to interpreting it as the site owner unless the user explicitly mentions assistant/AI/bot. Output only plain text paragraphs and text hyperlinks. Do not use headings, bullet lists, tables, code blocks, images, or JSON."
              : "你是个人网站前台的 AI 助手。你可以回答安全的通用问题、闲聊问题，也可以说明你能做什么。用户询问你能回答什么时，直接说明能力范围，不要提没有上下文、没有站内具体信息或检索限制。用户询问站点主人、作品、课程、合作方式等站内事实时，优先使用提供的站内上下文，不要编造事实。如果这类站内事实问题没有上下文，你可以说明可回答的范围，并引导用户换个更具体的问题。若用户问“你自己/你是谁”等，默认理解为在问站点主人；只有明确提到“助手/AI/机器人”时才介绍助手。输出形式只允许普通文本段落和文字超链接，不要使用标题、项目符号、表格、代码块、图片或 JSON。",
          },
          ...history,
          {
            role: "user",
            content: isEn
              ? `${isCapabilityQuestion ? "This is a capabilities question. Answer with what you can help with directly, and do not say that context or site details are missing.\n\n" : ""}User question: ${message}\n\nAvailable on-site context:\n${context || "(none)"}\n\nReturn a concise plain-text answer. Use short paragraphs only. If you include a link, use a text hyperlink such as [title](url). For casual or general questions, answer naturally even when context is empty. Do not output JSON.`
              : `${isCapabilityQuestion ? "这是能力范围说明问题。请直接回答你可以帮用户做什么，不要说缺少上下文、没有站内具体信息或无法检索。\n\n" : ""}用户问题：${message}\n\n可用站内上下文：\n${context || "（无）"}\n\n请输出简洁的纯文本回答，只使用短段落。如果需要放链接，使用 [文字](链接) 形式。闲聊或通用问题即使没有上下文也可以自然回答。不要输出 JSON。`,
          },
        ]
        try {
          answer = await provider.chat({ messages: promptMessages, temperature: 0.2, maxTokens: 700 })
        } catch (e) {
          console.error("[/api/ai/chat] provider error:", e)
          answer =
            citations.length > 0
              ? buildRetrievalAnswer(message, citations, identityIntent, isEn)
              : t("我暂时没有检索到足够依据来回答这个问题。你可以换个问法，或先查看相关页面。", "I do not have enough evidence from site content to answer this yet. Try rephrasing your question or check the related pages first.")
        }
      }
    }

    if (citations.length === 0 && manualKnowledge.length > 0 && routeMode === "retrieval") {
      const fallbackManual = manualKnowledge
        .filter((item) => item.showAsQuickQuestion)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0]
      if (fallbackManual) {
        citations = [manualToCitation(fallbackManual)]
      }
    }

    const topScore = ranked[0]?.score ?? 0
    const confidence =
      collectionIntent && citations.length > 0
        ? 0.85
        : Math.max(0, Math.min(0.95, topScore / 4))
    answer = sanitizeAnswerOutput(answer)
    if (isCapabilityQuestion && shouldUseCapabilityFallback(answer, isEn)) {
      answer = buildCapabilityAnswer(isEn)
      trace.push(t("能力说明兜底：已移除上下文不足表达", "Capability fallback: removed missing-context wording"))
    }
    citations = rerankCitationsByAnswer(answer, message, citations, referenceLimits.maxCitations)
    citations = workShowcaseIntent
      ? keepWorkCitations(citations, referenceLimits.maxCitations)
      : limitCitations(citations, referenceLimits.maxCitations)
    answer = constrainAnswerLinks(answer, citations)
    trace.push(
      citations.length > 0
        ? `${t("回答关联来源", "Answer references")}: ${citations
            .map((c) => `[${sourceTypeLabel(c.sourceType, isEn)}] ${c.title}`)
            .join(listSep)}`
        : `${t("回答关联来源", "Answer references")}: ${t("无", "None")}`,
    )

    const payload: ChatPayload = {
      sessionId: body?.sessionId || null,
      answer,
      citations,
      confidence,
      trace,
    }
    writeCache(cacheKey, { ...payload, sessionId: null }, cacheTtlMs)

    if (streamWanted) {
      return buildSSE(payload)
    }
    return NextResponse.json(payload)
  } catch (e) {
    console.error("[/api/ai/chat] failed:", e)
    return NextResponse.json(
      {
        error: "AI 请求失败",
        // 仅开发环境回传细节，生产不泄露后端/Provider 错误信息
        detail: process.env.NODE_ENV !== "production" ? (e instanceof Error ? e.message : "未知错误") : undefined,
      },
      { status: 500 },
    )
  }
}
