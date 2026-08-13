import { createHash } from "crypto"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { htmlToPlainText, jsonToPlainText } from "@/lib/content-format"
import { normalizeAboutModules } from "@/lib/about-types"
import { createAIProvider } from "@/lib/ai"
import { resolveAIConfig } from "@/lib/ai/runtime-config"
import { normalizeAIAssistantConfig } from "@/lib/ai-assistant-config"

export type PublicSourceType = "POST" | "WORK" | "TUTORIAL" | "SETTINGS"

type BuiltKnowledgeSource = {
  sourceType: PublicSourceType
  sourceId: string
  slug: string | null
  title: string
  url: string
  text: string
  updatedAt: Date
  meta?: Record<string, unknown>
}

type Chunk = {
  contentText: string
  contentTokens: number
  meta: Record<string, unknown>
}

const CHUNK_CHAR_SIZE = 900
const CHUNK_OVERLAP = 120

function stableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function localizedSlug(raw: unknown, locale: "zh" | "en", fallback: string): string {
  if (!raw || typeof raw !== "object") return fallback
  const value = (raw as Record<string, unknown>)[locale]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function isPublicTutorial(item: { title: string; slug: string }): boolean {
  return !item.slug.startsWith("draft-") && item.title.trim() !== "无标题教程"
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

function chunkText(text: string, meta: Record<string, unknown>): Chunk[] {
  const clean = normalizeWhitespace(text)
  if (!clean) return []
  const chunks: Chunk[] = []
  let start = 0
  let chunkIndex = 0
  while (start < clean.length) {
    const end = Math.min(clean.length, start + CHUNK_CHAR_SIZE)
    const slice = clean.slice(start, end).trim()
    if (slice) {
      chunks.push({
        contentText: slice,
        contentTokens: estimateTokens(slice),
        meta: { ...meta, chunkIndex },
      })
      chunkIndex += 1
    }
    if (end >= clean.length) break
    start = Math.max(0, end - CHUNK_OVERLAP)
  }
  return chunks
}

async function buildChunkEmbeddings(chunks: Chunk[]): Promise<Array<number[] | null>> {
  if (!chunks.length) return []
  const resolved = await resolveAIConfig()
  if (!resolved.configured) return chunks.map(() => null)
  if (!resolved.providerConfig.embeddingModel.trim()) return chunks.map(() => null)

  const provider = createAIProvider(resolved.providerConfig)
  const batchSize = 20
  const result: Array<number[] | null> = chunks.map(() => null)

  for (let start = 0; start < chunks.length; start += batchSize) {
    const end = Math.min(chunks.length, start + batchSize)
    const batch = chunks.slice(start, end)
    try {
      const vectors = await provider.embed?.({ texts: batch.map((chunk) => chunk.contentText) })
      for (let i = 0; i < batch.length; i += 1) {
        const embedding = vectors?.[i]
        result[start + i] = Array.isArray(embedding) ? embedding : null
      }
    } catch (e) {
      console.error("[knowledge] build embeddings failed:", e)
      for (let i = 0; i < batch.length; i += 1) {
        result[start + i] = null
      }
    }
  }

  return result
}

async function buildPostSource(postId: string): Promise<BuiltKnowledgeSource | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      slug: true,
      slugI18n: true,
      excerpt: true,
      content: true,
      coverImage: true,
      status: true,
      updatedAt: true,
      category: { select: { name: true } },
      tags: { select: { name: true } },
    },
  })
  if (!post || post.status !== "PUBLISHED") return null

  const excerptText = htmlToPlainText(post.excerpt)
  const body = jsonToPlainText(post.content)
  const category = post.category?.name ?? ""
  const tags = (post.tags ?? []).map((t) => t.name).join(" ")
  const text = [post.title, category, tags, excerptText, body].filter(Boolean).join("\n")
  const publicSlug = localizedSlug(post.slugI18n, "zh", post.slug)

  return {
    sourceType: "POST",
    sourceId: post.id,
    slug: publicSlug,
    title: post.title,
    url: `/blog/${publicSlug}`,
    text,
    updatedAt: post.updatedAt,
    meta: { category, tags: post.tags.map((t) => t.name) },
  }
}

async function buildWorkSource(workId: string): Promise<BuiltKnowledgeSource | null> {
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: {
      id: true,
      title: true,
      slug: true,
      workType: true,
      description: true,
      content: true,
      coverImage: true,
      images: true,
      status: true,
      updatedAt: true,
      category: { select: { name: true } },
      tags: { select: { name: true } },
    },
  })
  if (!work || work.status !== "PUBLISHED") return null

  const body = jsonToPlainText(work.content)
  const category = work.category?.name ?? ""
  const tags = (work.tags ?? []).map((t) => t.name).join(" ")
  const workTypeLabel = work.workType === "DEVELOPMENT" ? "开发作品" : "设计作品"
  const text = [work.title, workTypeLabel, category, tags, work.description ?? "", body].filter(Boolean).join("\n")

  return {
    sourceType: "WORK",
    sourceId: work.id,
    slug: work.slug,
    title: work.title,
    url: `/works/${work.slug}`,
    text,
    updatedAt: work.updatedAt,
    meta: { category, workType: work.workType, tags: work.tags.map((t) => t.name) },
  }
}

async function buildTutorialSource(tutorialId: string): Promise<BuiltKnowledgeSource | null> {
  const item = await prisma.videoTutorial.findUnique({
    where: { id: tutorialId },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      thumbnail: true,
      updatedAt: true,
      category: { select: { name: true } },
      tags: { select: { name: true } },
    },
  })
  if (!item || !isPublicTutorial(item)) return null

  const category = item.category?.name ?? ""
  const tags = (item.tags ?? []).map((t) => t.name).join(" ")
  const text = [item.title, category, tags, item.description ?? ""].filter(Boolean).join("\n")

  return {
    sourceType: "TUTORIAL",
    sourceId: item.id,
    slug: item.slug,
    title: item.title,
    url: `/tutorials#${item.slug}`,
    text,
    updatedAt: item.updatedAt,
    meta: { category, tags: item.tags.map((t) => t.name) },
  }
}

async function buildSettingsSource(): Promise<BuiltKnowledgeSource | null> {
  const settings = await prisma.settings.findUnique({
    where: { id: "settings" },
    select: {
      id: true,
      avatar: true,
      about: true,
      updatedAt: true,
    },
  })
  if (!settings) return null

  const about = normalizeAboutModules(settings.about as Parameters<typeof normalizeAboutModules>[0])
  const workExp = (about.workExperience ?? []).map((item) =>
    [item.company, item.role, item.period, item.description].filter(Boolean).join(" "),
  )
  const education = (about.education ?? []).map((item) => [item.school, item.degree, item.period].filter(Boolean).join(" "))
  const skills = (about.skills ?? []).map((item) => [item.name, item.level].filter(Boolean).join(" "))

  const text = [
    about.intro,
    ...workExp,
    ...education,
    ...skills,
  ]
    .filter(Boolean)
    .join("\n")

  return {
    sourceType: "SETTINGS",
    sourceId: settings.id,
    slug: null,
    title: "关于我",
    url: "/about",
    text,
    updatedAt: settings.updatedAt,
    meta: {},
  }
}

async function buildSource(sourceType: PublicSourceType, sourceId: string): Promise<BuiltKnowledgeSource | null> {
  if (sourceType === "POST") return buildPostSource(sourceId)
  if (sourceType === "WORK") return buildWorkSource(sourceId)
  if (sourceType === "TUTORIAL") return buildTutorialSource(sourceId)
  return buildSettingsSource()
}

export async function syncKnowledgeSource(sourceType: PublicSourceType, sourceId: string): Promise<void> {
  const locale = "ZH" as const
  const built = await buildSource(sourceType, sourceId)

  if (!built) {
    const row = await prisma.knowledgeSource.findUnique({
      where: { sourceType_sourceId_locale: { sourceType, sourceId, locale } },
      select: { id: true },
    })
    if (row?.id) {
      await prisma.knowledgeSource.delete({ where: { id: row.id } })
    }
    return
  }

  const normalizedText = normalizeWhitespace(built.text)
  const hash = stableHash(
    JSON.stringify({
      title: built.title,
      url: built.url,
      text: normalizedText,
      updatedAt: built.updatedAt.toISOString(),
    }),
  )

  const source = await prisma.knowledgeSource.upsert({
    where: { sourceType_sourceId_locale: { sourceType: built.sourceType, sourceId: built.sourceId, locale } },
    create: {
      sourceType: built.sourceType,
      sourceId: built.sourceId,
      locale,
      slug: built.slug,
      title: built.title,
      url: built.url,
      status: "ACTIVE",
      hash,
    },
    update: {
      slug: built.slug,
      title: built.title,
      url: built.url,
      status: "ACTIVE",
      hash,
    },
  })

  const chunks = chunkText(normalizedText, {
    sourceType: built.sourceType,
    sourceId: built.sourceId,
    ...(built.meta ?? {}),
  })
  const chunkEmbeddings = await buildChunkEmbeddings(chunks)

  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { sourceId: source.id } }),
    prisma.knowledgeAsset.deleteMany({ where: { sourceId: source.id } }),
    ...(chunks.length
      ? chunks.map((chunk, index) =>
          prisma.knowledgeChunk.create({
            data: {
              sourceId: source.id,
              locale,
              chunkIndex: index,
              contentText: chunk.contentText,
              contentTokens: chunk.contentTokens,
              embedding:
                chunkEmbeddings[index] == null
                  ? undefined
                  : (chunkEmbeddings[index] as unknown as Prisma.InputJsonValue),
              meta: chunk.meta as unknown as Prisma.InputJsonValue,
            },
          }),
        )
      : []),
  ])
}

export async function deleteKnowledgeSource(sourceType: PublicSourceType, sourceId: string): Promise<void> {
  const locale = "ZH" as const
  await prisma.knowledgeSource.delete({
    where: { sourceType_sourceId_locale: { sourceType, sourceId, locale } },
  }).catch(() => undefined)
}

export async function syncManySources(sourceType: PublicSourceType, sourceIds: string[]): Promise<void> {
  for (const sourceId of sourceIds) {
    await syncKnowledgeSource(sourceType, sourceId)
  }
}

export async function rebuildKnowledge(): Promise<void> {
  const [posts, works, tutorials, settings] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { id: true } }),
    prisma.work.findMany({ where: { status: "PUBLISHED" }, select: { id: true } }),
    prisma.videoTutorial.findMany({
      where: {
        NOT: [
          { slug: { startsWith: "draft-" } },
          { title: "无标题教程" },
        ],
      },
      select: { id: true },
    }),
    prisma.settings.findUnique({ where: { id: "settings" }, select: { id: true, aiAssistant: true } }),
  ])
  const retrievalSources = normalizeAIAssistantConfig(settings?.aiAssistant).retrievalSources

  if (retrievalSources.posts) {
    await syncManySources("POST", posts.map((p) => p.id))
  }
  if (retrievalSources.works) {
    await syncManySources("WORK", works.map((w) => w.id))
  }
  if (retrievalSources.tutorials) {
    await syncManySources("TUTORIAL", tutorials.map((t) => t.id))
  }
  if (settings?.id && retrievalSources.about) {
    await syncKnowledgeSource("SETTINGS", settings.id)
  }

  const keep = new Set<string>([
    ...(retrievalSources.posts ? posts.map((p) => `POST:${p.id}`) : []),
    ...(retrievalSources.works ? works.map((w) => `WORK:${w.id}`) : []),
    ...(retrievalSources.tutorials ? tutorials.map((t) => `TUTORIAL:${t.id}`) : []),
    ...(settings?.id && retrievalSources.about ? [`SETTINGS:${settings.id}`] : []),
  ])
  const allSources = await prisma.knowledgeSource.findMany({
    select: { sourceType: true, sourceId: true },
  })
  for (const item of allSources) {
    const key = `${item.sourceType}:${item.sourceId}`
    if (!keep.has(key)) {
      await deleteKnowledgeSource(item.sourceType as PublicSourceType, item.sourceId)
    }
  }
}
