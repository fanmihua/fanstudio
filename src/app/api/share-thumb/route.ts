/**
 * 微信分享卡片缩略图:把文章封面(webp)转成 jpg 返回。
 * 微信对 webp 缩略图支持不稳定,常导致卡片不出图甚至整卡失败 → 统一转 jpg。
 * 按 slug 查库取封面(避免任意路径),从 public/uploads 读盘转码。
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import sharp from "sharp"
import { readFile } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")
  if (!slug) return NextResponse.json({ error: "缺少 slug" }, { status: 400 })

  const postRef = await prisma.$queryRaw<Array<{ coverImage: string | null }>>`
    SELECT coverImage
    FROM Post
    WHERE slug = ${slug}
      OR JSON_UNQUOTE(JSON_EXTRACT(slugI18n, '$.zh')) = ${slug}
      OR JSON_UNQUOTE(JSON_EXTRACT(slugI18n, '$.en')) = ${slug}
    LIMIT 1
  `
  const cover = postRef[0]?.coverImage
  if (!cover || !cover.startsWith("/uploads/")) {
    return NextResponse.json({ error: "无封面" }, { status: 404 })
  }

  // 仅允许 public/uploads 下的文件,防目录穿越
  const uploadsRoot = path.join(process.cwd(), "public", "uploads")
  const filePath = path.join(process.cwd(), "public", cover)
  if (!filePath.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: "非法路径" }, { status: 400 })
  }

  try {
    const buf = await readFile(filePath)
    const jpg = await sharp(buf)
      .resize({ width: 720, withoutEnlargement: true }) // 保留封面比例,缩到 720 宽;微信卡片里自行裁切显示
      .jpeg({ quality: 82 })
      .toBuffer()
    return new NextResponse(new Uint8Array(jpg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "转换失败" }, { status: 500 })
  }
}
