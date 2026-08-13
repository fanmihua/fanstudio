/** NextAuth 配置：Credentials 邮箱+密码，与 User 表校验。 */
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "./prisma"
import {
  checkLoginAllowed,
  clearLoginFailures,
  loginThrottleKey,
  recordLoginFailure,
} from "./login-throttle"

/**
 * 从请求头取客户端 IP（与 getClientIp 同逻辑：优先不可伪造的 x-real-ip，回退 XFF 最后一段）。
 * 这里内联实现、不引 @/lib/guestbook——后者依赖 node:crypto，而本文件被中间件 proxy.ts 引用，
 * 避免把 node 内置模块带进中间件 bundle。
 */
function ipFromHeaders(headers: Headers | undefined | null): string {
  if (!headers || typeof headers.get !== "function") return "unknown"
  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return "unknown"
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials, request) {
        const email = (credentials?.email as string)?.trim?.()
        const password = (credentials?.password as string)?.trim?.()
        if (!email || !password) {
          return null
        }

        // 限流：按 email|ip 维度挡在线密码爆破。锁定期间直接拒绝（即使密码正确）。
        // 用 ip 维度 → 攻击者无法靠狂试某管理员邮箱把真管理员（另一 IP）锁死。
        const ip = ipFromHeaders((request as { headers?: Headers } | undefined)?.headers)
        const throttleKey = loginThrottleKey(email, ip)
        if (!checkLoginAllowed(throttleKey).ok) {
          return null
        }

        let user
        try {
          user = await prisma.user.findUnique({
            where: { email },
          })
        } catch (e) {
          console.error("[auth] DB 查询失败:", e)
          return null
        }
        if (!user) {
          recordLoginFailure(throttleKey)
          return null
        }
        const isPasswordValid = await bcrypt.compare(password, user.password)
        if (!isPasswordValid) {
          recordLoginFailure(throttleKey)
          return null
        }
        clearLoginFailures(throttleKey)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
        }
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        // fail-secure：角色缺失时给最低权限（VIEWER），不默认放行为 ADMIN
        token.role = (user as { role?: string }).role ?? "VIEWER"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
})
