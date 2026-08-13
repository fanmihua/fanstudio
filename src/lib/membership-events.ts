import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

export type MembershipEventLevel = "INFO" | "WARN" | "ERROR"

export type MembershipEventType =
  | "ORDER_CREATED"
  | "ORDER_REUSED"
  | "PAY_QR_CREATED"
  | "PAY_QR_FAILED"
  | "PAYMENT_NOTIFY_RECEIVED"
  | "PAYMENT_NOTIFY_IGNORED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_APPLIED"
  | "PAYMENT_DUPLICATE"
  | "CLEANUP_PENDING_CANCELLED"
  | "COMP_LIFETIME_TRANSFER"

type LogMembershipEventInput = {
  type: MembershipEventType
  level?: MembershipEventLevel
  message: string
  orderId?: string | null
  orderNo?: string | null
  memberId?: string | null
  productId?: string | null
  email?: string | null
  metadata?: Prisma.InputJsonValue
}

/** 会员链路事件日志：失败只写 server log，不影响下单、扫码或微信回调 ACK。 */
export async function logMembershipEvent(input: LogMembershipEventInput): Promise<void> {
  try {
    const data: Prisma.MembershipEventCreateInput = {
      type: input.type,
      level: input.level ?? "INFO",
      message: input.message.slice(0, 255),
      orderId: input.orderId ?? null,
      orderNo: input.orderNo ?? null,
      memberId: input.memberId ?? null,
      productId: input.productId ?? null,
      email: input.email ?? null,
    }
    if (input.metadata !== undefined) data.metadata = input.metadata
    await prisma.membershipEvent.create({ data })
  } catch (err) {
    console.warn("[membership-event] failed to write log", err)
  }
}
