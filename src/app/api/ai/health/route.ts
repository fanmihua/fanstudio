import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { resolveAIConfig } from "@/lib/ai/runtime-config"

export const dynamic = "force-dynamic"

export async function GET() {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const resolved = await resolveAIConfig()
  const config = resolved.providerConfig
  const configured = resolved.configured

  const hasKnowledgeModel =
    Boolean(
      (prisma as unknown as {
        knowledgeSource?: unknown
      }).knowledgeSource,
    )

  if (!hasKnowledgeModel) {
    return NextResponse.json({
      configured,
      provider: config.provider,
      chatModel: config.chatModel,
      embeddingModel: config.embeddingModel,
      baseUrl: config.baseUrl,
      modelId: resolved.modelId,
      modelLabel: resolved.modelLabel,
      hasApiKey: Boolean(config.apiKey),
      dbReady: false,
      knowledge: {
        sources: 0,
        chunks: 0,
      },
    })
  }

  const [sources, chunks] = await Promise.all([
    prisma.knowledgeSource.count({ where: { status: "ACTIVE" } }),
    prisma.knowledgeChunk.count({ where: { source: { status: "ACTIVE" } } }),
  ])

  return NextResponse.json({
    configured,
    provider: config.provider,
    chatModel: config.chatModel,
    embeddingModel: config.embeddingModel,
    baseUrl: config.baseUrl,
    modelId: resolved.modelId,
    modelLabel: resolved.modelLabel,
    hasApiKey: Boolean(config.apiKey),
    dbReady: true,
    knowledge: {
      sources,
      chunks,
    },
  })
}
