import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/require-admin"
import { getEnvAIProviderConfig } from "@/lib/ai/provider"
import { normalizeAIModelConfig, type AIModelConfig } from "@/lib/ai-model-config"

export const dynamic = "force-dynamic"

function hasSettingsField(fieldName: string): boolean {
  const runtimeModel = (prisma as unknown as {
    _runtimeDataModel?: { models?: Record<string, { fields?: Array<{ name: string }> }> }
  })._runtimeDataModel
  const fields = runtimeModel?.models?.Settings?.fields
  if (!Array.isArray(fields)) return true
  return fields.some((field) => field.name === fieldName)
}

async function getStoredConfigRaw(): Promise<unknown> {
  if (!hasSettingsField("aiModelConfig")) return null
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

function maskApiKey(apiKey: string): string {
  if (!apiKey) return ""
  if (apiKey.length <= 8) return "*".repeat(apiKey.length)
  return `${apiKey.slice(0, 4)}${"*".repeat(Math.max(4, apiKey.length - 8))}${apiKey.slice(-4)}`
}

export async function GET() {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const envConfig = getEnvAIProviderConfig()
  const raw = await getStoredConfigRaw()
  const config = normalizeAIModelConfig(raw, envConfig)

  return NextResponse.json({
    ...config,
    apiKeyMasked: maskApiKey(config.apiKey),
    hasApiKey: Boolean(config.apiKey),
    apiKey: "",
  })
}

export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  try {
    if (!hasSettingsField("aiModelConfig")) {
      return NextResponse.json(
        {
          error: "保存失败",
          detail: "Prisma Client 尚未更新，缺少 aiModelConfig 字段。请执行 `npx prisma generate` 并重启服务。",
        },
        { status: 409 },
      )
    }

    const body = (await request.json()) as Partial<AIModelConfig> & { clearApiKey?: boolean }
    const envConfig = getEnvAIProviderConfig()
    const raw = await getStoredConfigRaw()
    const existing = normalizeAIModelConfig(raw, envConfig)

    const merged: AIModelConfig = normalizeAIModelConfig(
      {
        ...existing,
        ...body,
        apiKey:
          body.clearApiKey === true
            ? ""
            : typeof body.apiKey === "string"
              ? (body.apiKey.trim() ? body.apiKey.trim() : existing.apiKey)
              : existing.apiKey,
        models: Array.isArray(body.models) ? body.models : existing.models,
      },
      envConfig,
    )

    const exists = await prisma.settings.findUnique({ where: { id: "settings" }, select: { id: true } })
    if (exists) {
      await prisma.settings.update({
        where: { id: "settings" },
        data: { aiModelConfig: merged },
      })
    } else {
      await prisma.settings.create({
        data: {
          id: "settings",
          siteName: "Fan's Studio",
          aiModelConfig: merged,
        },
      })
    }

    return NextResponse.json({
      ...merged,
      apiKeyMasked: maskApiKey(merged.apiKey),
      hasApiKey: Boolean(merged.apiKey),
      apiKey: "",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败"
    return NextResponse.json({ error: "保存失败", detail: message }, { status: 500 })
  }
}
