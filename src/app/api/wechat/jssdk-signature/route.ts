/**
 * 微信 JS-SDK 签名服务。
 * 前端 wx.config 需要 { appId, timestamp, nonceStr, signature }。
 * 流程:appid+secret → access_token → jsapi_ticket → sha1 签名。
 * access_token / jsapi_ticket 各有效 2 小时、每天有调用上限,必须缓存(本进程内存)。
 * 注意:调用 access_token 接口要求本服务器公网 IP 在公众号「IP 白名单」内。
 */
import { NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"

export const dynamic = "force-dynamic"

type Cached = { value: string; expireAt: number }
const wxState = globalThis as typeof globalThis & {
  __wxToken?: Cached
  __wxTicket?: Cached
}

// JS-SDK 用「公众号」的 appid（与 AppSecret 必须同一个号）。
// 注意:支付绑定的 WECHAT_APP_ID 可能是另一个 app,这里优先用公众号专用的 WECHAT_MP_APP_ID。
const APPID = process.env.WECHAT_MP_APP_ID || process.env.WECHAT_APP_ID
const SECRET = process.env.WECHAT_APP_SECRET

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (wxState.__wxToken && wxState.__wxToken.expireAt > now) return wxState.__wxToken.value
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`
  const res = await fetch(url, { cache: "no-store" })
  const data = (await res.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }
  if (!data.access_token) {
    throw new Error(`access_token 获取失败: ${data.errcode} ${data.errmsg}`)
  }
  // 提前 5 分钟过期,留余量
  wxState.__wxToken = { value: data.access_token, expireAt: now + ((data.expires_in ?? 7200) - 300) * 1000 }
  return data.access_token
}

async function getJsapiTicket(): Promise<string> {
  const now = Date.now()
  if (wxState.__wxTicket && wxState.__wxTicket.expireAt > now) return wxState.__wxTicket.value
  const token = await getAccessToken()
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${token}&type=jsapi`
  const res = await fetch(url, { cache: "no-store" })
  const data = (await res.json()) as { ticket?: string; expires_in?: number; errcode?: number; errmsg?: string }
  if (!data.ticket) {
    throw new Error(`jsapi_ticket 获取失败: ${data.errcode} ${data.errmsg}`)
  }
  wxState.__wxTicket = { value: data.ticket, expireAt: now + ((data.expires_in ?? 7200) - 300) * 1000 }
  return data.ticket
}

export async function GET(request: NextRequest) {
  if (!APPID || !SECRET) {
    return NextResponse.json({ error: "微信公众号未配置(WECHAT_MP_APP_ID / WECHAT_APP_SECRET)" }, { status: 500 })
  }
  // 前端传当前页面 URL(不含 #hash);微信签名要求与 wx.config 所在页面 URL 完全一致
  const url = request.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 })
  }
  try {
    const ticket = await getJsapiTicket()
    const nonceStr = randomBytes(16).toString("hex")
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`
    const signature = createHash("sha1").update(raw).digest("hex")
    return NextResponse.json({ appId: APPID, timestamp, nonceStr, signature })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "签名生成失败" }, { status: 502 })
  }
}
