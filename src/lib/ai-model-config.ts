import type { AIProviderConfig, AIProviderName } from "@/lib/ai/provider"

export type AIModelOption = {
  id: string
  label: string
  chatModel: string
  enabled: boolean
}

export type AIModelConfig = {
  enabled: boolean
  provider: AIProviderName
  baseUrl: string
  apiKey: string
  embeddingModel: string
  defaultModelId: string
  allowVisitorModelSwitch: boolean
  models: AIModelOption[]
}

// 公开（前台）配置：除 apiKey 外，也不暴露 baseUrl / embeddingModel
// （可能指向内网/自建网关，属基础设施信息），前台仅需模型列表与切换设置。
export type PublicAIModelConfig = Omit<
  AIModelConfig,
  "apiKey" | "models" | "baseUrl" | "embeddingModel"
> & {
  models: Array<Pick<AIModelOption, "id" | "label">>
}

function sanitizeId(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 40) || "model"
}

export function defaultAIModelConfig(envConfig: AIProviderConfig): AIModelConfig {
  return {
    enabled: envConfig.enabled,
    provider: envConfig.provider,
    baseUrl: envConfig.baseUrl,
    apiKey: envConfig.apiKey,
    embeddingModel: envConfig.embeddingModel,
    defaultModelId: "default",
    allowVisitorModelSwitch: false,
    models: [
      {
        id: "default",
        label: envConfig.chatModel,
        chatModel: envConfig.chatModel,
        enabled: true,
      },
    ],
  }
}

export function normalizeAIModelConfig(raw: unknown, envConfig: AIProviderConfig): AIModelConfig {
  const fallback = defaultAIModelConfig(envConfig)
  if (!raw || typeof raw !== "object") return fallback

  const obj = raw as Record<string, unknown>
  const provider = obj.provider === "openai" ? "openai" : fallback.provider
  const enabled = typeof obj.enabled === "boolean" ? obj.enabled : fallback.enabled
  const baseUrl = typeof obj.baseUrl === "string" && obj.baseUrl.trim() ? obj.baseUrl.trim() : fallback.baseUrl
  const apiKey = typeof obj.apiKey === "string" ? obj.apiKey.trim() : fallback.apiKey
  const embeddingModel =
    typeof obj.embeddingModel === "string"
      ? obj.embeddingModel.trim()
      : fallback.embeddingModel
  const allowVisitorModelSwitch =
    typeof obj.allowVisitorModelSwitch === "boolean"
      ? obj.allowVisitorModelSwitch
      : fallback.allowVisitorModelSwitch

  const normalizedModels = Array.isArray(obj.models)
    ? obj.models
        .map((item, index) => {
          if (!item || typeof item !== "object") return null
          const record = item as Record<string, unknown>
          const chatModel = typeof record.chatModel === "string" ? record.chatModel.trim() : ""
          if (!chatModel) return null
          const rawId = typeof record.id === "string" ? record.id : `model-${index + 1}`
          const id = sanitizeId(rawId)
          const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : chatModel
          const enabledItem = typeof record.enabled === "boolean" ? record.enabled : true
          return { id, label, chatModel, enabled: enabledItem }
        })
        .filter((item): item is AIModelOption => Boolean(item))
        .slice(0, 10)
    : fallback.models

  const models = normalizedModels.length > 0 ? normalizedModels : fallback.models
  const enabledModels = models.filter((item) => item.enabled)
  const defaultModelId =
    typeof obj.defaultModelId === "string" && obj.defaultModelId.trim() ? sanitizeId(obj.defaultModelId) : fallback.defaultModelId
  const finalDefaultModelId = enabledModels.some((item) => item.id === defaultModelId)
    ? defaultModelId
    : enabledModels[0]?.id ?? models[0].id

  return {
    enabled,
    provider,
    baseUrl,
    apiKey,
    embeddingModel,
    allowVisitorModelSwitch,
    defaultModelId: finalDefaultModelId,
    models,
  }
}

export function toPublicAIModelConfig(config: AIModelConfig): PublicAIModelConfig {
  const enabledModels = config.models.filter((item) => item.enabled)
  return {
    enabled: config.enabled,
    provider: config.provider,
    defaultModelId: config.defaultModelId,
    allowVisitorModelSwitch: config.allowVisitorModelSwitch,
    models: enabledModels.map((item) => ({ id: item.id, label: item.label })),
  }
}
