import { NextResponse } from "next/server"
import { getCurrentMember } from "@/lib/require-member"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

function displayPlanName(planName: string): string {
  return planName
    .replace(/赠送\s*·\s*永久/g, "赠送通行")
    .replace(/永久通行/g, "通行权益")
    .replace(/永久/g, "通行权益")
}

/** GET: 当前登录会员的通行记录（不展示未付款单；未付款单只留在后台排查）。 */
export async function GET() {
  const member = await getCurrentMember()
  if (!member || member.disabled) return NextResponse.json({ orders: [] })
  const orders = await prisma.membershipOrder.findMany({
    where: {
      memberId: member.id,
      status: { not: "PENDING" },
    },
    select: {
      orderNo: true,
      planName: true,
      amount: true,
      status: true,
      source: true,
      createdAt: true,
      paidAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json({
    orders: orders.map((o) => ({ ...o, planName: displayPlanName(o.planName), amount: Number(o.amount) })),
  })
}
