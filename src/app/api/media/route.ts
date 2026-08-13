import { NextRequest, NextResponse } from "next/server"
import { WorkType } from "@prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import {
  saveFile,
  deleteFile,
  getMediaTypeFromMime,
  type MediaEntityType,
} from "@/lib/media-storage"

export const dynamic = "force-dynamic"

// 上传大小上限（默认 50MB，可经 MEDIA_MAX_UPLOAD_MB 覆盖）：防止超大文件耗尽磁盘/内存。
const MAX_UPLOAD_BYTES = (Number(process.env.MEDIA_MAX_UPLOAD_MB) || 50) * 1024 * 1024

const ENTITY_TYPES: MediaEntityType[] = [
  "POST",
  "WORK_DESIGN",
  "WORK_DEVELOPMENT",
  "TUTORIAL",
  "ABOUT",
]

function isEntityType(s: string): s is MediaEntityType {
  return ENTITY_TYPES.includes(s as MediaEntityType)
}

export async function GET(request: NextRequest) {
  try {
    const check = await requireAdmin()
    if (!check.authorized) return check.response

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entityType")

    if (!entityType || !isEntityType(entityType)) {
      return NextResponse.json(
        { error: "缺少或无效的 entityType" },
        { status: 400 }
      )
    }

    let list: Awaited<ReturnType<typeof prisma.media.findMany>> = []
    try {
      list = await prisma.media.findMany({
        where: { entityType },
        orderBy: { createdAt: "desc" },
      })
    } catch {
      list = []
    }

    const byEntity = new Map<string, typeof list>()
    for (const m of list) {
      if (!byEntity.has(m.entityId)) byEntity.set(m.entityId, [])
      byEntity.get(m.entityId)!.push(m)
    }

    let entities: { id: string; title: string }[] = []
    if (entityType === "POST") {
      const posts = await prisma.post.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      })
      entities = posts.map((p) => ({ id: p.id, title: p.title }))
    }
    if (entityType === "WORK_DESIGN" || entityType === "WORK_DEVELOPMENT") {
      const workType = entityType === "WORK_DESIGN" ? WorkType.DESIGN : WorkType.DEVELOPMENT
      const works = await prisma.work.findMany({
        where: { workType },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      })
      entities = works.map((w) => ({ id: w.id, title: w.title }))
    }
    if (entityType === "TUTORIAL") {
      const tutorials = await prisma.videoTutorial.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true },
      })
      entities = tutorials.map((t) => ({ id: t.id, title: t.title }))
    }

    const groups = entities.map(({ id: entityId, title: entityTitle }) => ({
      entityId,
      entityTitle,
      items: byEntity.get(entityId) ?? [],
    }))

    return NextResponse.json({ groups }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (e) {
    console.error("[GET /api/media]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "服务器错误" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const entityTypeRaw = formData.get("entityType") as string | null
  const entityId = (formData.get("entityId") as string)?.trim()

  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 })
  }
  if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `文件过大，最大 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB` },
      { status: 413 },
    )
  }
  if (!entityTypeRaw || !isEntityType(entityTypeRaw)) {
    return NextResponse.json({ error: "请指定有效的 entityType（POST / WORK_DESIGN / WORK_DEVELOPMENT / TUTORIAL）" }, { status: 400 })
  }
  if (!entityId) {
    return NextResponse.json({ error: "请指定 entityId" }, { status: 400 })
  }
  // entityId 只允许安全字符（防 path.join 目录穿越）；合法实体 id 均为 cuid，满足此约束。
  if (!/^[A-Za-z0-9_-]+$/.test(entityId)) {
    return NextResponse.json({ error: "无效的 entityId" }, { status: 400 })
  }

  const entityType = entityTypeRaw as MediaEntityType
  const buffer = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || "application/octet-stream"
  const mediaType = getMediaTypeFromMime(mimeType)

  try {
    const { url } = await saveFile(
      buffer,
      entityType,
      entityId,
      file.name,
      mimeType
    )

    const media = await prisma.media.create({
      data: {
        name: file.name,
        url,
        type: mediaType,
        size: buffer.length,
        width: null,
        height: null,
        entityType,
        entityId,
      },
    })

    return NextResponse.json(media)
  } catch (e) {
    console.error("[media upload]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 500 }
    )
  }
}
