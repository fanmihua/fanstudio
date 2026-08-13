/**
 * 自动取消过期的待支付会员购买单。
 * 默认只处理 24 小时前的 PENDING + PURCHASE，并自动归档，不影响刚扫码但还没支付的用户。
 *
 * 用法：
 *   npm run membership:cleanup-pending -- --dry-run
 *   npm run membership:cleanup-pending -- --hours=24
 */
import prisma from "@/lib/prisma"

function readHours(): number {
  const arg = process.argv.find((item) => item.startsWith("--hours="))
  const hours = arg ? Number(arg.split("=")[1]) : 24
  return Number.isFinite(hours) && hours >= 1 ? Math.floor(hours) : 24
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const hours = readHours()
  const cutoff = new Date(Date.now() - hours * 60 * 60_000)
  const staleOrders = await prisma.membershipOrder.findMany({
    where: {
      source: "PURCHASE",
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      orderNo: true,
      memberId: true,
      productId: true,
      buyerEmail: true,
      planName: true,
      amount: true,
      createdAt: true,
    },
  })

  console.log(
    `[membership-cleanup] mode=${dryRun ? "dry-run" : "write"} cutoff=${cutoff.toISOString()} stale=${staleOrders.length}`,
  )

  if (staleOrders.length === 0) return

  if (dryRun) {
    for (const order of staleOrders.slice(0, 20)) {
      console.log(
        `[membership-cleanup] stale ${order.orderNo} ${order.buyerEmail} ${order.planName} ¥${Number(order.amount)} ${order.createdAt.toISOString()}`,
      )
    }
    if (staleOrders.length > 20) {
      console.log(`[membership-cleanup] ${staleOrders.length - 20} more omitted`)
    }
    return
  }

  let cancelled = 0
  await prisma.$transaction(async (tx) => {
    for (const order of staleOrders) {
      const archivedAt = new Date()
      const result = await tx.membershipOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "CANCELLED", archivedAt },
      })
      if (result.count !== 1) continue
      cancelled += 1
      await tx.membershipEvent.create({
        data: {
          type: "CLEANUP_PENDING_CANCELLED",
          level: "INFO",
          message: `自动取消并归档超过 ${hours} 小时未支付的会员订单`,
          orderId: order.id,
          orderNo: order.orderNo,
          memberId: order.memberId,
          productId: order.productId,
          email: order.buyerEmail,
          metadata: {
            cutoffHours: hours,
            planName: order.planName,
            amount: Number(order.amount),
            createdAt: order.createdAt.toISOString(),
            archivedAt: archivedAt.toISOString(),
          },
        },
      })
    }
  })

  console.log(`[membership-cleanup] cancelled=${cancelled}`)
}

main()
  .catch((err) => {
    console.error("[membership-cleanup] failed", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
