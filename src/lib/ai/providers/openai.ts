import type { AIChatInput, AIProvider, AIProviderConfig, AIEmbedInput } from "@/lib/ai/provider"

type OpenAIChatChoice = {
  message?: {
    content?: string | null
  }
}

type OpenAIChatResponse = {
  choices?: OpenAIChatChoice[]
}

type OpenAIEmbeddingItem = {
  embedding: number[]
}

type OpenAIEmbeddingResponse = {
  data?: OpenAIEmbeddingItem[]
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url
}

export class OpenAIProvider implements AIProvider {
  private readonly config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
  }

  async chat(input: AIChatInput): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)
    try {
      const res = await fetch(`${normalizeBaseUrl(this.config.baseUrl)}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.chatModel,
          messages: input.messages,
          temperature: input.temperature ?? 0.2,
          max_tokens: input.maxTokens ?? 800,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`Chat provider error: ${res.status} ${text}`)
      }
      const data = (await res.json()) as OpenAIChatResponse
      const content = data.choices?.[0]?.message?.content?.trim()
      if (!content) throw new Error("Chat provider empty response")
      return content
    } finally {
      clearTimeout(timer)
    }
  }

  async embed(input: AIEmbedInput): Promise<number[][]> {
    if (!input.texts.length) return []
    const res = await fetch(`${normalizeBaseUrl(this.config.baseUrl)}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        input: input.texts,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Embedding provider error: ${res.status} ${text}`)
    }
    const data = (await res.json()) as OpenAIEmbeddingResponse
    return (data.data ?? []).map((item) => item.embedding)
  }
}

