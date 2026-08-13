/**
 * 安全加固回归测试（纯逻辑，无需 DB）：
 * 1. clientIpFromHeaders —— 防伪造 X-Forwarded-For 取值
 * 2. login-throttle    —— 后台登录失败锁定 + 按 IP 维度隔离
 * 运行：npx tsx scripts/test-security-hardening.ts
 */
import assert from "node:assert/strict"
import { clientIpFromHeaders } from "../src/lib/guestbook"
import {
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
  loginThrottleKey,
  __resetLoginThrottle,
  LOGIN_THROTTLE_CONFIG,
} from "../src/lib/login-throttle"

// ---- 1. clientIpFromHeaders ----
function h(init: Record<string, string>): Headers {
  return new Headers(init)
}

// 有 x-real-ip：直接采用，忽略客户端伪造的 XFF 首段
assert.equal(
  clientIpFromHeaders(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4" })),
  "203.0.113.9",
  "应优先采用不可伪造的 x-real-ip",
)

// 无 x-real-ip，XFF 多段：取【最后一段】(nginx 追加的真实对端)，而非可伪造的首段
assert.equal(
  clientIpFromHeaders(h({ "x-forwarded-for": "66.66.66.66, 203.0.113.9" })),
  "203.0.113.9",
  "应取 XFF 最后一段，而非攻击者伪造的首段",
)

// 攻击者只塞了一个伪造 IP（nginx 未追加的极端情形）→ 仍只能拿到这个值，但绝不能把首段当成可信
assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "9.9.9.9" })), "9.9.9.9")

// 关键回归：旧实现会把 "evil" 当客户端 IP；新实现取最后一段 "real"
assert.equal(
  clientIpFromHeaders(h({ "x-forwarded-for": "evil-spoof, real-edge" })),
  "real-edge",
  "伪造首段不应被采纳",
)

// 啥都没有 → unknown
assert.equal(clientIpFromHeaders(h({})), "unknown")

console.log("✓ clientIpFromHeaders 防伪造取值正确")

// ---- 2. login-throttle ----
__resetLoginThrottle()
const attacker = loginThrottleKey("admin@example.com", "66.66.66.66")
const realAdmin = loginThrottleKey("admin@example.com", "10.0.0.2") // 同邮箱、不同 IP

// 初始放行
assert.equal(checkLoginAllowed(attacker).ok, true)

// 连续失败到阈值 → 锁定
for (let i = 0; i < LOGIN_THROTTLE_CONFIG.MAX_FAILURES; i++) {
  assert.equal(checkLoginAllowed(attacker).ok, true, `第 ${i + 1} 次尝试前应仍放行`)
  recordLoginFailure(attacker)
}
const locked = checkLoginAllowed(attacker)
assert.equal(locked.ok, false, "达到失败阈值后应锁定")
assert.ok(locked.retryAfter > 0, "锁定应返回剩余秒数")

// 关键回归：攻击者狂试某邮箱，不应把【同邮箱、另一 IP 的真管理员】锁死（避免 DoS）
assert.equal(
  checkLoginAllowed(realAdmin).ok,
  true,
  "按 IP 维度隔离：攻击者无法靠刷某邮箱锁死真管理员",
)

// 登录成功清零后恢复放行
clearLoginFailures(attacker)
assert.equal(checkLoginAllowed(attacker).ok, true, "清零后应恢复放行")

console.log("✓ login-throttle 锁定与按 IP 隔离正确")

console.log("\nall security hardening tests passed")
