/** 权限检查：确保当前用户已登录且为 ADMIN 角色。VIEWER 返回 403。 */
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

type AuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse }

/** 检查登录 + ADMIN 角色。未登录返回 401，VIEWER 返回 403。 */
export async function requireAdmin(): Promise<AuthResult> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "未登录" }, { status: 401 }),
    }
  }

  const role = (session.user as { role?: string }).role
  // 白名单：仅 ADMIN 放行；VIEWER / 未来新角色 / 角色缺失一律拒绝（fail-secure）
  if (role !== "ADMIN") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "无权限查看或修改（体验账户仅可浏览界面）" },
        { status: 403 },
      ),
    }
  }

  return { authorized: true, userId: session.user.id }
}
