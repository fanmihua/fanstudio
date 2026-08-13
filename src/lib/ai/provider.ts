export type AIChatRole = "system" | "user" | "assistant"

export interface AIChatMessage {
  role: AIChatRole
  content: string
}

export interface AIChatInput {
  messages: AIChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface AIEmbedInput {
  texts: string[]
}

export interface AIProvider {
  chat(input: AIChatInput): Promise<string>
  embed?(input: AIEmbedInput): Promise<number[][]>
}

export type AIProviderName = "openai"

export interface AIProviderConfig {
  enabled: boolean
  provider: AIProviderName
  baseUrl: string
  apiKey: string
  chatModel: string
  embeddingModel: string
}

function env(name: string): string {
  return (process.env[name] || "").trim()
}

function truthy(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase())
}

export function getEnvAIProviderConfig(): AIProviderConfig {
  const enabled = truthy(env("AI_ENABLED"))
  const provider = (env("AI_PROVIDER") || "openai") as AIProviderName
  const baseUrl = env("AI_BASE_URL") || "https://api.openai.com/v1"
  const apiKey = env("AI_API_KEY")
  const chatModel = env("AI_CHAT_MODEL") || "gpt-4.1-mini"
  const embeddingModel = env("AI_EMBEDDING_MODEL") || "text-embedding-3-small"

  return { enabled, provider, baseUrl, apiKey, chatModel, embeddingModel }
}

export function getAIProviderConfig(): AIProviderConfig {
  return getEnvAIProviderConfig()
}

export function isAIConfigured(config: AIProviderConfig): boolean {
  return Boolean(config.enabled && config.apiKey && config.chatModel)
}
