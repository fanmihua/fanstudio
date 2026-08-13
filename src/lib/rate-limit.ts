import { NextRequest, NextResponse } from "next/server"
import { getClientIp } from "@/lib/guestbook"

type RateState = {
  count: number
  windowStart: number
  expiresAt: number
}

const runtime = globalThis as typeof globalThis & {
  __fanstudioRate?: Map<string, RateState>
  __fanstudioRateLastSweep?: number
}

function rateMap(): Map<string, RateState> {
  if (!runtime.__fanstudioRate) runtime.__fanstudioRate = new Map()
  return runtime.__fanstudioRate
}

function sweepExpired(now: number): void {
  if (runtime.__fanstudioRateLastSweep && now - runtime.__fanstudioRateLastSweep < 60_000) return
  runtime.__fanstudioRateLastSweep = now
  const map = rateMap()
  for (const [key, state] of map.entries()) {
    if (state.expiresAt <= now) map.delete(key)
  }
}

export function checkRouteRateLimit(
  request: NextRequest,
  opts: {
    namespace: string
    limit: number
    windowMs: number
    key?: string | null
  },
): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  sweepExpired(now)
  const key = `${opts.namespace}:${opts.key || getClientIp(request)}`
  const map = rateMap()
  const state = map.get(key)
  if (!state || now - state.windowStart >= opts.windowMs) {
    map.set(key, { count: 1, windowStart: now, expiresAt: now + opts.windowMs * 2 })
    return { ok: true, retryAfter: 0 }
  }
  if (state.count >= opts.limit) {
    const retryAfterMs = opts.windowMs - (now - state.windowStart)
    return { ok: false, retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) }
  }
  state.count += 1
  state.expiresAt = now + opts.windowMs * 2
  map.set(key, state)
  return { ok: true, retryAfter: 0 }
}

export function rateLimitJson(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: "操作太频繁，请稍后再试" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  )
}
