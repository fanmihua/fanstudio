import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/require-admin"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

const EVENT_TYPES = new Set([
  "ORDER_CREATED",
  "ORDER_REUSED",
  "PAY_QR_CREATED",
  "PAY_QR_FAILED",
  "PAYMENT_NOTIFY_RECEIVED",
  "PAYMENT_NOTIFY_IGNORED",
  "PAYMENT_AMOUNT_MISMATCH",
  "PAYMENT_APPLIED",
  "PAYMENT_DUPLICATE",
  "CLEANUP_PENDING_CANCELLED",
])
const EVENT_LEVELS = new Set(["INFO", "WARN", "ERROR"])

/** GET: 会员支付/订单事件日志（最近 200 条）。 */
export async function GET(request: NextRequest) {
  const check = await requireAdmin()
  if (!check.authorized) return check.response

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") || "all"
  const level = searchParams.get("level") || "all"
  const q = searchParams.get("q")?.trim()

  const where: Prisma.MembershipEventWhereInput = {}
  if (EVENT_TYPES.has(type)) where.type = type
  if (EVENT_LEVELS.has(level)) where.level = level
  if (q) {
    where.OR = [
      { orderNo: { contains: q } },
      { email: { contains: q } },
      { message: { contains: q } },
      { type: { contains: q } },
    ]
  }

  const events = await prisma.membershipEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return NextResponse.json(
    events.map((event) => ({
      id: event.id,
      type: event.type,
      level: event.level,
      message: event.message,
      orderNo: event.orderNo,
      memberId: event.memberId,
      email: event.email,
      metadata: event.metadata,
      createdAt: event.createdAt,
    })),
  )
}
