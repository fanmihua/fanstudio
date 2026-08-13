/**
 * 邮箱登录验证码：生成 / 存储（仅存 sha256）/ 冷却 / 校验 / 消费。
 * 验证码本身从不落库明文，hash 绑定 email 防跨邮箱套用。
 */
import { createHash, randomInt } from "crypto"
import prisma from "@/lib/prisma"

const CODE_TTL_MIN = 10 // 有效期（分钟）
const MAX_ATTEMPTS = 5 // 单个码最大试错次数
const RESEND_COOLDOWN_SEC = 60 // 重发冷却（秒）

function normEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${normEmail(email)}:${code}`).digest("hex")
}

/** 生成 6 位数字验证码。 */
function genCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0")
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; error: string; retryAfter?: number }

/**
 * 签发验证码：冷却检查 → 写新码（sha256）→ 返回明文 code 交调用方发邮件。
 * 不直接发邮件，便于路由层在 dev 无 SMTP 时回显 code。
 */
export async function issueVerificationCode(email: string): Promise<IssueResult> {
  const e = normEmail(email)

  const recent = await prisma.verificationCode.findFirst({
    where: {
      email: e,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_SEC * 1000) },
    },
    orderBy: { createdAt: "desc" },
  })
  if (recent) {
    return { ok: false, error: "验证码刚发过，请稍后再试", retryAfter: RESEND_COOLDOWN_SEC }
  }

  const code = genCode()
  await prisma.verificationCode.create({
    data: {
      email: e,
      codeHash: hashCode(e, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000),
    },
  })
  return { ok: true, code }
}

export interface VerifyResult {
  ok: boolean
  error?: string
}

/**
 * 校验验证码：取最新未消费未过期码 → 比对 → 成功标 consumed；失败累加 attempts。
 */
export async function verifyVerificationCode(
  email: string,
  code: string,
): Promise<VerifyResult> {
  const e = normEmail(email)
  const input = (code || "").trim()
  if (!/^\d{6}$/.test(input)) {
    return { ok: false, error: "验证码格式不正确" }
  }

  const rec = await prisma.verificationCode.findFirst({
    where: { email: e, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })
  if (!rec) {
    return { ok: false, error: "验证码无效或已过期，请重新获取" }
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "尝试次数过多，请重新获取验证码" }
  }
  if (rec.codeHash !== hashCode(e, input)) {
    await prisma.verificationCode.update({
      where: { id: rec.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false, error: "验证码不正确" }
  }

  await prisma.verificationCode.update({
    where: { id: rec.id },
    data: { consumedAt: new Date() },
  })
  return { ok: true }
}

export const CODE_TTL_MINUTES = CODE_TTL_MIN
