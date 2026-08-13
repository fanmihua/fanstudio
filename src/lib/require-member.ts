/**
 * 会员（顾客）鉴权辅助。读 member_session cookie → 查 Member。
 * 访问判定按「产品权益」：会员对某产品是否有有效 Entitlement（含全站通），封禁直接拒绝。
 */
import type { Member } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getMemberIdFromCookie } from "@/lib/member-session"

/** 当前登录会员；未登录或会员不存在返回 null。 */
export async function getCurrentMember(): Promise<Member | null> {
  const id = await getMemberIdFromCookie()
  if (!id) return null
  try {
    const member = await prisma.member.findUnique({ where: { id } })
    return member?.archivedAt ? null : member
  } catch {
    return null
  }
}

/** 会员对某产品是否有有效访问权（含全站通；封禁或未登录直接 false）。 */
export async function memberHasProductAccess(
  member: Pick<Member, "id" | "disabled" | "archivedAt"> | null | undefined,
  productKey: string,
): Promise<boolean> {
  if (!member || member.disabled || member.archivedAt) return false
  const now = new Date()
  const ent = await prisma.entitlement.findFirst({
    where: {
      memberId: member.id,
      revokedAt: null,
      OR: [{ isLifetime: true }, { expiresAt: { gt: now } }],
      product: { OR: [{ key: productKey }, { isAllAccess: true }] },
    },
    select: { id: true },
  })
  return !!ent
}
