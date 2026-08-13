import prisma from "@/lib/prisma"
import { normalizeAIModelConfig, type AIModelConfig, type AIModelOption } from "@/lib/ai-model-config"
import { getEnvAIProviderConfig, isAIConfigured, type AIProviderConfig } from "@/lib/ai/provider"

export type ResolvedAIConfig = {
  providerConfig: AIProviderConfig
  configured: boolean
  modelId: string
  modelLabel: string
  allowVisitorModelSwitch: boolean
  models: AIModelOption[]
  rawModelConfig: AIModelConfig
}

type ResolveOptions = {
  modelId?: string | null
}

async function getStoredAIModelConfigRaw(): Promise<unknown> {
  try {
    const row = await prisma.settings.findUnique({
      where: { id: "settings" },
      select: { aiModelConfig: true },
    })
    return row?.aiModelConfig ?? null
  } catch {
    return null
  }
}

export async function resolveAIConfig(options?: ResolveOptions): Promise<ResolvedAIConfig> {
  const envConfig = getEnvAIProviderConfig()
  const stored = await getStoredAIModelConfigRaw()
  const modelConfig = normalizeAIModelConfig(stored, envConfig)
  const enabledModels = modelConfig.models.filter((item) => item.enabled)
  const defaultModel =
    enabledModels.find((item) => item.id === modelConfig.defaultModelId) ??
    enabledModels[0] ??
    modelConfig.models[0]

  const requestedModelId = options?.modelId?.trim()
  const selectedModel =
    requestedModelId && modelConfig.allowVisitorModelSwitch
      ? enabledModels.find((item) => item.id === requestedModelId) ?? defaultModel
      : defaultModel

  const providerConfig: AIProviderConfig = {
    enabled: modelConfig.enabled,
    provider: modelConfig.provider,
    baseUrl: modelConfig.baseUrl,
    apiKey: modelConfig.apiKey,
    chatModel: selectedModel.chatModel,
    embeddingModel: modelConfig.embeddingModel,
  }

  return {
    providerConfig,
    configured: isAIConfigured(providerConfig),
    modelId: selectedModel.id,
    modelLabel: selectedModel.label,
    allowVisitorModelSwitch: modelConfig.allowVisitorModelSwitch,
    models: enabledModels,
    rawModelConfig: modelConfig,
  }
}
