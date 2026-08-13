import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function requiredEnv(name: "ADMIN_EMAIL" | "ADMIN_PASSWORD"): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`缺少 ${name}`)
  return value
}

async function main() {
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase()
  const password = requiredEnv("ADMIN_PASSWORD")
  const name = process.env.ADMIN_NAME?.trim() || "站点管理员"

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL 格式无效")
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD 至少需要 12 个字符")
  }
  if (/changeme|password|123456/i.test(password)) {
    throw new Error("ADMIN_PASSWORD 过于简单，请使用随机强密码")
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, password: hashedPassword, role: "ADMIN" },
    create: { email, name, password: hashedPassword, role: "ADMIN" },
    select: { id: true, email: true, name: true, role: true },
  })

  console.log("生产管理员已就绪:", admin)
  console.log("请清除终端中的 ADMIN_PASSWORD，并妥善保存密码。")
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
