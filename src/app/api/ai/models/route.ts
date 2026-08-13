import { NextResponse } from "next/server"
import { resolveAIConfig } from "@/lib/ai/runtime-config"
import { toPublicAIModelConfig } from "@/lib/ai-model-config"

export const dynamic = "force-dynamic"

export async function GET() {
  const resolved = await resolveAIConfig()
  const config = toPublicAIModelConfig(resolved.rawModelConfig)
  return NextResponse.json({
    ...config,
    activeModelId: resolved.modelId,
  })
}
