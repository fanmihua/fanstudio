/**
 * 一次性迁移：把 Settings 里以 base64 data URL 内联的图片（头像 / 收款码 / 站点图标）
 * 转存为 public/uploads 下的真实文件，字段改为 URL —— 避免它们被序列化进每个页面的 HTML。
 * 幂等：已是 URL 的字段跳过。运行前会把整行设置备份到 settings-backup-*.json。
 * 用法：npx tsx prisma/migrate-base64-images.ts
 */
import { PrismaClient } from "@prisma/client"
import sharp from "sharp"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { createHash } from "crypto"

const prisma = new PrismaClient()
const REL_DIR = "public/uploads/ABOUT/site"
const URL_PREFIX = "/uploads/ABOUT/site"

// 内容哈希 -> URL，去重（同一张图在多处内联只存一次）
const cache = new Map<string, string>()

async function toFile(dataUrl: string, label: string, maxDim: number, format: "webp" | "png"): Promise<string | null> {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) return null
  const raw = m[2]
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16)
  const cached = cache.get(hash)
  if (cached) return cached

  const buf = Buffer.from(raw, "base64")
  let pipeline = sharp(buf).resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
  pipeline = format === "png" ? pipeline.png({ compressionLevel: 9 }) : pipeline.webp({ quality: 88 })
  const out = await pipeline.toBuffer()

  await mkdir(path.join(process.cwd(), REL_DIR), { recursive: true })
  const name = `${label}-${hash}.${format}`
  await writeFile(path.join(process.cwd(), REL_DIR, name), out)
  const url = `${URL_PREFIX}/${name}`
  cache.set(hash, url)
  console.log(`  ${label}: ${Math.round(raw.length / 1024)}KB base64 -> ${url} (${Math.round(out.length / 1024)}KB)`)
  return url
}

function isData(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image")
}

async function main() {
  const s = await prisma.settings.findUnique({ where: { id: "settings" } })
  if (!s) {
    console.log("无 settings 记录")
    return
  }

  await writeFile(`settings-backup-${Date.now()}.json`, JSON.stringify(s, null, 2))
  console.log("已备份设置到 settings-backup-*.json")

  const data: Record<string, unknown> = {}

  // 头像
  if (isData(s.avatar)) {
    const url = await toFile(s.avatar, "avatar", 640, "webp")
    if (url) data.avatar = url
  }

  // 社交收款码（微信 / 公众号 等，二维码用高质量 webp 保清晰）
  if (s.socialLinks && typeof s.socialLinks === "object") {
    const social = { ...(s.socialLinks as Record<string, unknown>) }
    let changed = false
    for (const [k, v] of Object.entries(social)) {
      if (isData(v)) {
        const url = await toFile(v, `social-${k}`, 600, "webp")
        if (url) {
          social[k] = url
          changed = true
        }
      }
    }
    if (changed) data.socialLinks = social
  }

  // 站点图标（favicon 用 png 保兼容，缩到 256）
  const fixFavicon = async (pc: Record<string, unknown>): Promise<boolean> => {
    if (isData(pc.siteFavicon)) {
      const url = await toFile(pc.siteFavicon as string, "favicon", 256, "png")
      if (url) {
        pc.siteFavicon = url
        return true
      }
    }
    return false
  }

  if (s.pageCopy && typeof s.pageCopy === "object") {
    const pc = { ...(s.pageCopy as Record<string, unknown>) }
    if (await fixFavicon(pc)) data.pageCopy = pc
  }
  if (s.pageCopyI18n && typeof s.pageCopyI18n === "object") {
    const i18n = { ...(s.pageCopyI18n as Record<string, Record<string, unknown> | null>) }
    let changed = false
    for (const loc of ["zh", "en"]) {
      if (i18n[loc] && typeof i18n[loc] === "object") {
        const pc = { ...(i18n[loc] as Record<string, unknown>) }
        if (await fixFavicon(pc)) {
          i18n[loc] = pc
          changed = true
        }
      }
    }
    if (changed) data.pageCopyI18n = i18n
  }

  if (Object.keys(data).length === 0) {
    console.log("没有需要迁移的 base64 图片（可能已经是 URL）")
    return
  }

  await prisma.settings.update({ where: { id: "settings" }, data })
  console.log("迁移完成，已更新字段:", Object.keys(data).join(", "))
}

main()
  .catch((e) => {
    console.error("迁移失败:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
