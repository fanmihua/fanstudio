import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

/** PATCH: 修改当前用户密码（需验证旧密码）。 */
export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const body = await request.json()
  const oldPassword = (body.oldPassword as string)?.trim()
  const newPassword = (body.newPassword as string)?.trim()

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "请填写旧密码和新密码" }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "新密码至少 6 位" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: check.userId } })
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 })
  }

  const isOldValid = await bcrypt.compare(oldPassword, user.password)
  if (!isOldValid) {
    return NextResponse.json({ error: "旧密码不正确" }, { status: 403 })
  }

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: check.userId },
    data: { password: hashed },
  })

  return NextResponse.json({ message: "密码修改成功" })
}
