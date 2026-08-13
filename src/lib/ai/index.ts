import { OpenAIProvider } from "@/lib/ai/providers/openai"
import { getAIProviderConfig } from "@/lib/ai/provider"
import type { AIProvider } from "@/lib/ai/provider"

export function createAIProvider(config = getAIProviderConfig()): AIProvider {
  return new OpenAIProvider(config)
}
