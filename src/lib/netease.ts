/** 网易云音乐链接解析：从完整链接 / 分享文本 / 原始数字里提取歌曲数字 ID。 */

/**
 * 同步解析（无网络）：处理纯数字、含 ?id= / &id= 的完整链接、/song/数字 路径。
 * 短链（如 163cn.tv/xxx）里没有 id，无法在此解析，返回 null（交给服务端跟随跳转）。
 */
export function parseNeteaseSongId(input: string | null | undefined): string | null {
  if (!input) return null
  const s = String(input).trim()
  if (/^\d{4,}$/.test(s)) return s
  const q = s.match(/[?&]id=(\d+)/)
  if (q) return q[1]
  const p = s.match(/\/song\/(\d+)/)
  if (p) return p[1]
  return null
}

/** 从一段文本里抽出第一个 http(s) 链接（兼容整段分享文案粘贴）。 */
export function extractFirstUrl(input: string | null | undefined): string | null {
  if (!input) return null
  const m = String(input).match(/https?:\/\/[^\s)）]+/)
  return m ? m[0] : null
}

export type NeteaseSong = { id: string; name?: string; artist?: string; cover?: string }

/** 服务端：按歌曲 id 拉取歌名 / 歌手 / 封面，失败时只返回 id。 */
export async function fetchNeteaseSong(id: string): Promise<NeteaseSong> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`https://music.163.com/api/song/detail/?ids=%5B${encodeURIComponent(id)}%5D`, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://music.163.com" },
      signal: ctrl.signal,
    })
    const d = await res.json()
    const s = (d?.songs || [])[0] || {}
    const artist = (s.artists || []).map((a: { name?: string }) => a?.name).filter(Boolean).join(", ")
    return {
      id,
      name: s.name || undefined,
      artist: artist || undefined,
      cover: s.album?.picUrl || undefined,
    }
  } catch {
    return { id }
  } finally {
    clearTimeout(timer)
  }
}
