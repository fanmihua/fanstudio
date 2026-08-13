/**
 * 后台管理员登录失败限流（挡在线密码爆破 / 撞库）。
 *
 * 设计要点：
 * - 维度 = `email|ip`。按 IP 维度限的是【攻击者自己那台机器】对某邮箱的连续试错，
 *   因此攻击者无法靠狂试某管理员邮箱把【真管理员（另一 IP）】锁死，避免拒绝服务。
 * - 失败累加、成功清零；达到阈值后进入锁定窗口，期间即使密码正确也拒绝。
 * - 与本仓库其它限流一致：进程内内存态。cluster（instances>1）下各 worker 各算各的，
 *   实际阈值≈配置值×worker 数；要做到跨进程严格一致需迁到共享存储（Redis / 一张计数表）。
 *   即便如此，配合 bcrypt 的慢哈希，本层已能把暴力破解从“无限尝试”压到可控量级。
 */

const MAX_FAILURES = 8 // 窗口内最大失败次数
const WINDOW_MS = 15 * 60_000 // 失败计数窗口
const LOCKOUT_MS = 15 * 60_000 // 触发后锁定时长
const SWEEP_MS = 60_000 // 过期项清理节流

type ThrottleState = {
  failures: number
  windowStart: number
  lockedUntil: number
}

const runtime = globalThis as typeof globalThis & {
  __loginThrottle?: Map<string, ThrottleState>
  __loginThrottleLastSweep?: number
}

function store(): Map<string, ThrottleState> {
  if (!runtime.__loginThrottle) runtime.__loginThrottle = new Map()
  return runtime.__loginThrottle
}

function sweep(now: number): void {
  if (runtime.__loginThrottleLastSweep && now - runtime.__loginThrottleLastSweep < SWEEP_MS) return
  runtime.__loginThrottleLastSweep = now
  const map = store()
  for (const [key, s] of map.entries()) {
    const stale = s.lockedUntil <= now && now - s.windowStart >= WINDOW_MS
    if (stale) map.delete(key)
  }
}

/** 规范化限流键：邮箱小写 + IP。 */
export function loginThrottleKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip || "unknown"}`
}

/** 当前是否允许尝试登录。被锁定返回 ok:false 及剩余秒数。 */
export function checkLoginAllowed(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  sweep(now)
  const s = store().get(key)
  if (s && s.lockedUntil > now) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((s.lockedUntil - now) / 1000)) }
  }
  return { ok: true, retryAfter: 0 }
}

/** 记一次登录失败；达到阈值则进入锁定窗口。 */
export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const map = store()
  const s = map.get(key)
  if (!s || now - s.windowStart >= WINDOW_MS) {
    map.set(key, { failures: 1, windowStart: now, lockedUntil: 0 })
    return
  }
  s.failures += 1
  if (s.failures >= MAX_FAILURES) {
    s.lockedUntil = now + LOCKOUT_MS
  }
  map.set(key, s)
}

/** 登录成功：清除该键的失败记录。 */
export function clearLoginFailures(key: string): void {
  store().delete(key)
}

/** 仅供测试：清空全部状态。 */
export function __resetLoginThrottle(): void {
  runtime.__loginThrottle = new Map()
  runtime.__loginThrottleLastSweep = undefined
}

export const LOGIN_THROTTLE_CONFIG = { MAX_FAILURES, WINDOW_MS, LOCKOUT_MS } as const
