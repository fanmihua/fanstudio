/** 后台用：把网易云分享链接/短链/文本解析成歌曲数字 ID（跟随跳转）。仅管理员可用。 */
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { parseNeteaseSongId, extractFirstUrl, fetchNeteaseSong } from "@/lib/netease"

export const dynamic = "force-dynamic"

/** SSRF 白名单：仅允许网易云自家域名（含短链），其余一律拒绝。
 *  严格域名校验本身即排除了内网 IP / 任意主机，无需再单独判私网段。 */
function isAllowedNeteaseHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === "163cn.tv" || h === "163.com" || h.endsWith(".163.com")
}

/** 解析为 http(s) URL 且 host 在白名单内，否则返回 null。 */
function toAllowedUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (!isAllowedNeteaseHost(url.hostname)) return null
  return url
}

/**
 * SSRF 安全的跟随跳转：手动逐跳校验目标 host 必须在网易云白名单内，最多 3 跳。
 * 防止白名单域被 302 跳到内网（每跳都校验，而非只信任初始 URL）。
 */
async function safeFollow(
  initial: string,
  signal: AbortSignal,
): Promise<{ res: Response; finalUrl: string } | null> {
  let current = initial
  for (let i = 0; i < 4; i++) {
    if (!toAllowedUrl(current)) return null
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      signal,
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (!loc) return { res, finalUrl: current }
      current = new URL(loc, current).toString()
      continue
    }
    return { res, finalUrl: current }
  }
  return null // 跳转过多，视为异常
}

export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const raw = new URL(request.url).searchParams.get("u")?.trim()
  if (!raw) return NextResponse.json({ error: "缺少链接" }, { status: 400 })

  // 完整链接 / 纯数字：直接解析
  const direct = parseNeteaseSongId(raw)
  if (direct) return NextResponse.json(await fetchNeteaseSong(direct))

  // 整段分享文案：抽出第一个 URL，跟随跳转后从最终地址里取 id
  const target = extractFirstUrl(raw)
  if (!target) return NextResponse.json({ error: "没识别到链接，请粘贴网易云链接" }, { status: 400 })
  if (!toAllowedUrl(target)) {
    return NextResponse.json({ error: "仅支持网易云音乐（music.163.com / 163cn.tv）链接" }, { status: 400 })
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const followed = await safeFollow(target, ctrl.signal)
    if (!followed) {
      return NextResponse.json({ error: "仅支持网易云音乐链接，或跳转异常" }, { status: 400 })
    }
    const { res, finalUrl } = followed
    let id = parseNeteaseSongId(finalUrl)
    if (!id) id = parseNeteaseSongId(await res.text())
    if (id) return NextResponse.json(await fetchNeteaseSong(id))
    return NextResponse.json({ error: "没解析到歌曲 ID，请直接粘贴含 id 的歌曲链接" }, { status: 422 })
  } catch {
    return NextResponse.json({ error: "解析超时，请直接粘贴含 id 的歌曲链接" }, { status: 504 })
  } finally {
    clearTimeout(timer)
  }
}
