import fs from "fs/promises"
import path from "path"
import prisma from "@/lib/prisma"
import { deleteFile } from "@/lib/media-storage"

export const MEDIA_CLEANUP_GRACE_DAYS = 30

const UPLOAD_URL_RE = /\/uploads\/[^"'\\\s<>)]+/g

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function extractUploadUrls(value: unknown): Set<string> {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "")
  const matches = text.match(UPLOAD_URL_RE) ?? []
  return new Set(matches.map((url) => url.replace(/\\u0026/g, "&")))
}

function addUrls(target: Set<string>, value: unknown) {
  for (const url of extractUploadUrls(value)) target.add(url)
}

export async function collectReferencedUploadUrls(): Promise<Set<string>> {
  const referenced = new Set<string>()
  const [posts, works, versions, tutorials, settings] = await Promise.all([
    prisma.post.findMany({
      select: {
        content: true,
        contentI18n: true,
        coverImage: true,
        excerpt: true,
        excerptI18n: true,
        seoI18n: true,
      },
    }),
    prisma.work.findMany({
      select: {
        description: true,
        descriptionI18n: true,
        content: true,
        contentI18n: true,
        coverImage: true,
        images: true,
        demoQrCode: true,
        fileUrl: true,
      },
    }),
    prisma.workVersion.findMany({
      select: {
        changelog: true,
        fileUrl: true,
      },
    }),
    prisma.videoTutorial.findMany({
      select: {
        description: true,
        descriptionI18n: true,
        thumbnail: true,
        seoI18n: true,
      },
    }),
    prisma.settings.findMany(),
  ])

  for (const row of posts) addUrls(referenced, row)
  for (const row of works) addUrls(referenced, row)
  for (const row of versions) addUrls(referenced, row)
  for (const row of tutorials) addUrls(referenced, row)
  for (const row of settings) addUrls(referenced, row)
  return referenced
}

async function fileExistsForUploadUrl(url: string): Promise<boolean> {
  if (!url.startsWith("/uploads/")) return false
  const relativePath = url.replace(/^\/uploads\//, "")
  const absolutePath = path.join(process.cwd(), "public/uploads", relativePath)
  try {
    await fs.access(absolutePath)
    return true
  } catch {
    return false
  }
}

export async function reconcileMediaCleanup(graceDays = MEDIA_CLEANUP_GRACE_DAYS) {
  const now = new Date()
  const cleanupAt = addDays(now, graceDays)
  const referenced = await collectReferencedUploadUrls()
  const media = await prisma.media.findMany({
    select: {
      id: true,
      url: true,
      cleanupAt: true,
      lastReferencedAt: true,
    },
  })

  const referencedIds: string[] = []
  const newlyPendingIds: string[] = []

  for (const item of media) {
    if (referenced.has(item.url)) {
      if (item.cleanupAt || !item.lastReferencedAt) referencedIds.push(item.id)
    } else if (!item.cleanupAt) {
      newlyPendingIds.push(item.id)
    }
  }

  if (referencedIds.length > 0) {
    await prisma.media.updateMany({
      where: { id: { in: referencedIds } },
      data: { cleanupAt: null, lastReferencedAt: now },
    })
  }

  if (newlyPendingIds.length > 0) {
    await prisma.media.updateMany({
      where: { id: { in: newlyPendingIds } },
      data: { cleanupAt },
    })
  }

  return {
    mediaRows: media.length,
    referencedUrls: referenced.size,
    restored: referencedIds.length,
    newlyPending: newlyPendingIds.length,
    cleanupAt,
  }
}

export async function deleteExpiredUnreferencedMedia(now = new Date()) {
  const referenced = await collectReferencedUploadUrls()
  const expired = await prisma.media.findMany({
    where: { cleanupAt: { lte: now } },
    select: { id: true, url: true },
  })

  let deleted = 0
  let restored = 0

  for (const item of expired) {
    if (referenced.has(item.url)) {
      await prisma.media.update({
        where: { id: item.id },
        data: { cleanupAt: null, lastReferencedAt: now },
      })
      restored += 1
      continue
    }

    await deleteFile(item.url)
    await prisma.media.delete({ where: { id: item.id } })
    deleted += 1
  }

  return { checked: expired.length, deleted, restored }
}

export async function runMediaCleanupCycle() {
  const reconcile = await reconcileMediaCleanup()
  const expired = await deleteExpiredUnreferencedMedia()
  return { reconcile, expired }
}

export async function safeRunMediaCleanupCycle(context: string) {
  try {
    return await runMediaCleanupCycle()
  } catch (error) {
    console.warn(`[media-cleanup:${context}]`, error)
    return null
  }
}

export async function getMediaCleanupReport() {
  const referenced = await collectReferencedUploadUrls()
  const media = await prisma.media.findMany({
    orderBy: [{ cleanupAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      url: true,
      type: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      cleanupAt: true,
      lastReferencedAt: true,
    },
  })

  const rows = await Promise.all(
    media.map(async (item) => ({
      ...item,
      referenced: referenced.has(item.url),
      fileExists: await fileExistsForUploadUrl(item.url),
    })),
  )

  return {
    counts: {
      mediaRows: rows.length,
      referencedUrls: referenced.size,
      pendingCleanup: rows.filter((item) => item.cleanupAt && !item.referenced).length,
      referencedPending: rows.filter((item) => item.cleanupAt && item.referenced).length,
      missingFiles: rows.filter((item) => !item.fileExists).length,
      unreferenced: rows.filter((item) => !item.referenced).length,
    },
    rows,
  }
}
