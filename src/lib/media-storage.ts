/**
 * 媒体文件存储封装 — 本地磁盘存储。
 * 文件保存在 public/uploads/{entityType}/{entityId}/ 目录下，
 * 由 Next.js / Nginx 静态文件服务直接返回。
 *
 * 图片上传时自动使用 sharp 压缩为 WebP 格式（GIF 除外），
 * 长边限制 1920px，质量 80，兼顾清晰度与体积。
 */
import { writeFile, mkdir, unlink } from "fs/promises"
import path from "path"
import { randomBytes } from "crypto"
import sharp from "sharp"

const UPLOAD_DIR = "public/uploads"

const MAX_DIMENSION = 1920
const WEBP_QUALITY = 80
const PNG_COMPRESSION_LEVEL = 9

/**
 * 落盘扩展名白名单（决定静态服务返回的 Content-Type）。
 * 刻意排除 .svg/.html/.xml/.js 等可被浏览器内联执行脚本的类型，杜绝同源存储型 XSS。
 * 图片（非 GIF）会先经 sharp 重编码为 .webp；其余类型按此白名单校验落盘扩展名。
 */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".tiff", ".ico",
  ".mp4", ".webm", ".mov", ".m4v",
  ".mp3", ".wav", ".m4a", ".aac", ".ogg",
  ".pdf",
])

export type MediaEntityType = "POST" | "WORK_DESIGN" | "WORK_DEVELOPMENT" | "TUTORIAL" | "ABOUT"

export interface SaveFileResult {
  /** 可直接在 <img src> 中使用的 URL，如 /uploads/POST/abc/xxx.webp */
  url: string
  /** 存储路径 key，如 POST/abc123/xxxx-image.webp */
  key: string
}

type SaveFileOptions = {
  imageFormat?: "webp" | "png"
  maxDimension?: number
  webpQuality?: number
}

/** 保存文件到本地；图片（非 GIF）自动压缩为 WebP 并限制尺寸。 */
export async function saveFile(
  buffer: Buffer,
  entityType: MediaEntityType,
  entityId: string,
  originalName: string,
  mimeType: string,
  options: SaveFileOptions = {},
): Promise<SaveFileResult> {
  let finalBuffer = buffer
  let finalExt = getExtension(originalName, mimeType)

  // 图片自动压缩为 WebP（GIF 保留原格式以支持动图）
  if (mimeType.startsWith("image/") && mimeType !== "image/gif") {
    const imageFormat = options.imageFormat ?? "webp"
    const maxDimension = options.maxDimension ?? MAX_DIMENSION
    const pipeline = sharp(buffer).resize(maxDimension, maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    })
    if (imageFormat === "png") {
      finalBuffer = await pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL }).toBuffer()
      finalExt = ".png"
    } else {
      finalBuffer = await pipeline.webp({ quality: options.webpQuality ?? WEBP_QUALITY }).toBuffer()
      finalExt = ".webp"
    }
  }

  // 落盘扩展名白名单：拒绝 svg/html/js 等可内联执行脚本的类型（同源存储型 XSS 防线）。
  if (!ALLOWED_EXTENSIONS.has(finalExt.toLowerCase())) {
    throw new Error(`不支持的文件类型：${finalExt || "(未知)"}`)
  }
  // 防目录穿越：entityId 只允许安全字符（cuid/uuid 等均满足），含 / 或 .. 一律拒绝。
  if (!/^[A-Za-z0-9_-]+$/.test(entityId)) {
    throw new Error("无效的 entityId")
  }

  const safeName = sanitizeFileName(originalName) || "file"
  const nameWithoutExt = safeName.replace(/\.[^.]+$/, "")
  const baseName = `${randomBytes(8).toString("hex")}-${nameWithoutExt}`
  const fileName = `${baseName}${finalExt}`
  const key = `${entityType}/${entityId}/${fileName}`

  const uploadRoot = path.join(process.cwd(), UPLOAD_DIR)
  const absolutePath = path.join(uploadRoot, key)
  // 纵深防御：断言最终路径仍在 uploads 目录内，杜绝任何残留穿越。
  if (absolutePath !== uploadRoot && !absolutePath.startsWith(uploadRoot + path.sep)) {
    throw new Error("非法的存储路径")
  }
  const dir = path.dirname(absolutePath)
  await mkdir(dir, { recursive: true })
  await writeFile(absolutePath, finalBuffer, { flag: "wx" })

  const url = `/uploads/${key.replace(/\\/g, "/")}`
  return { url, key }
}

/** 根据 URL 删除本地上传文件；非 /uploads/ 或文件不存在时静默忽略。 */
export async function deleteFile(url: string): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return
  try {
    const relativePath = url.replace(/^\/uploads\//, "")
    const absolutePath = path.join(process.cwd(), UPLOAD_DIR, relativePath)
    await unlink(absolutePath)
  } catch {
    // ignore
  }
}

function getExtension(originalName: string, mimeType: string): string {
  const fromName = path.extname(originalName)
  if (fromName) return fromName
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  }
  return mimeToExt[mimeType] ?? ""
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w\u4e00-\u9fa5.-]/g, "_")
    .slice(0, 80)
}

/** 把 base64 data URL 图片转存为文件并返回 URL；非图片 data URL 原样返回。 */
export async function saveDataUrlAsFile(
  value: string,
  entityType: MediaEntityType,
  entityId: string,
  options: SaveFileOptions = {},
): Promise<string> {
  if (typeof value !== "string" || !value.startsWith("data:image/")) return value
  const match = value.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) throw new Error("图片数据格式无效，请重新上传图片")
  try {
    const buffer = Buffer.from(match[2], "base64")
    const ext = match[1].split("/")[1] || "png"
    const { url } = await saveFile(buffer, entityType, entityId, `image.${ext}`, match[1], options)
    return url
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片处理失败"
    throw new Error(`图片处理失败：${message}`)
  }
}

/** 递归把 JSON 值中的 base64 图片转存为文件 URL（用于设置里的内联图片）。 */
export async function convertBase64Images<T>(value: T, entityType: MediaEntityType, entityId: string): Promise<T> {
  if (typeof value === "string") {
    return (await saveDataUrlAsFile(value, entityType, entityId)) as unknown as T
  }
  if (Array.isArray(value)) {
    const out: unknown[] = []
    for (const item of value) out.push(await convertBase64Images(item, entityType, entityId))
    return out as unknown as T
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await convertBase64Images(v, entityType, entityId)
    }
    return out as unknown as T
  }
  return value
}

export function getMediaTypeFromMime(mime: string): "image" | "video" | "file" {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  return "file"
}

export const saveFileToLocal = saveFile
