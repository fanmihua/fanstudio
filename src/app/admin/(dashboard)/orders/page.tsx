"use client"
/** 订单管理：列表、筛选、批量更新状态、查看详情。 */
import { useState, useEffect, useMemo, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTableControls } from "@/hooks/useTableControls"
import { TableToolbar, type ToolbarFilter, type BatchAction } from "@/components/admin/TableToolbar"
import { TablePagination } from "@/components/admin/TablePagination"
import { SortableTableHead } from "@/components/admin/SortableTableHead"
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

type OrderItem = {
  id: string
  orderNo: string
  workTitle: string
  workId: string
  buyerEmail: string
  buyerName: string | null
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
}

export default function OrdersPage() {
  const { locale } = useAdminUiLocale()
  const t = useCallback((zh: string, en: string) => (locale === "en" ? en : zh), [locale])

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: t("待支付", "Pending"), variant: "outline" },
    PAID: { label: t("已支付", "Paid"), variant: "default" },
    CANCELLED: { label: t("已取消", "Cancelled"), variant: "destructive" },
    REFUNDED: { label: t("已退款", "Refunded"), variant: "destructive" },
  }

  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    orderId: string
    orderNo: string
    action: "CANCELLED" | "REFUNDED" | "DELETE"
  } | null>(null)

  const tc = useTableControls<OrderItem>({
    data: orders,
    searchFields: ["orderNo", "buyerEmail", "workTitle"],
    defaultPageSize: 20,
  })

  const toolbarFilters: ToolbarFilter[] = useMemo(() => [
    {
      key: "status",
      label: t("状态", "Status"),
      options: [
        { label: t("待支付", "Pending"), value: "PENDING" },
        { label: t("已支付", "Paid"), value: "PAID" },
        { label: t("已取消", "Cancelled"), value: "CANCELLED" },
        { label: t("已退款", "Refunded"), value: "REFUNDED" },
      ],
    },
  ], [t])

  const fetchOrders = useCallback(() => {
    setLoading(true)
    setForbiddenMessage(null)
    fetch("/api/orders?all=1", { credentials: "include" })
      .then(async (r) => {
        const data = await r.json()
        if (r.status === 403) {
          setForbiddenMessage(typeof data?.error === "string" ? data.error : t("无权限查看订单", "No permission to view orders"))
          setOrders([])
        } else {
          setOrders(Array.isArray(data) ? data : [])
        }
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  async function updateStatus(orderId: string, newStatus: string) {
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) fetchOrders()
    } finally { setActionLoading(null) }
  }

  const handleBatchStatus = useCallback(async (status: string) => {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/orders/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, status }),
      })
      if (res.ok) { tc.clearSelection(); fetchOrders() }
    } catch { /* ignore */ }
  }, [tc, fetchOrders])

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(tc.selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch("/api/orders/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      })
      if (res.ok) { tc.clearSelection(); fetchOrders() }
    } catch { /* ignore */ }
  }, [tc, fetchOrders])

  const batchActions: BatchAction[] = useMemo(() => {
    const ids = Array.from(tc.selectedIds)
    const selectedOrders = orders.filter((o) => ids.includes(o.id))
    const allPending = selectedOrders.every((o) => o.status === "PENDING")
    const actions: BatchAction[] = []
    if (allPending && selectedOrders.length > 0) {
      actions.push(
        {
          label: t("标记已支付", "Mark Paid"), icon: "ri-checkbox-circle-line", onClick: () => handleBatchStatus("PAID"),
          needConfirm: true, confirmTitle: t(`确定将 ${selectedOrders.length} 个订单标记为已支付？`, `Mark ${selectedOrders.length} selected orders as paid?`),
        },
        {
          label: t("取消订单", "Cancel Orders"), icon: "ri-close-circle-line", variant: "destructive", onClick: () => handleBatchStatus("CANCELLED"),
          needConfirm: true, confirmTitle: t(`确定取消选中的 ${selectedOrders.length} 个订单？`, `Cancel ${selectedOrders.length} selected orders?`), confirmDescription: t("取消后不可撤回", "This cannot be undone"),
        },
      )
    }
    if (selectedOrders.length > 0) {
      actions.push({
        label: t("删除选中订单", "Delete Selected"),
        icon: "ri-delete-bin-line",
        variant: "destructive",
        onClick: () => handleBatchDelete(),
        needConfirm: true,
        confirmTitle: t(`确定删除选中的 ${selectedOrders.length} 个订单？`, `Delete ${selectedOrders.length} selected orders?`),
        confirmDescription: t("删除后不可恢复", "This action cannot be undone"),
      })
    }
    return actions
  }, [tc.selectedIds, orders, t, handleBatchDelete, handleBatchStatus])

  async function deleteOrder(orderId: string) {
    setActionLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE", credentials: "include" })
      if (res.ok) fetchOrders()
    } finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground">{t("订单管理", "Orders")}</h1>
        <p className="text-muted-foreground mt-1">{t("查看和管理所有订单", "View and manage all orders")}</p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden p-4">
        <TableToolbar
          searchValue={tc.searchTerm}
          onSearchChange={tc.setSearchTerm}
          searchPlaceholder={t("搜索订单号、邮箱或商品…", "Search order no, email or product…")}
          filters={toolbarFilters}
          filterValues={tc.filters}
          onFilterChange={tc.setFilter}
          selectedCount={tc.selectedIds.size}
          batchActions={batchActions}
          onClearSelection={tc.clearSelection}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox checked={tc.isAllSelected} onCheckedChange={() => tc.toggleSelectAll()} />
              </TableHead>
              <SortableTableHead column="orderNo" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>{t("订单号", "Order No.")}</SortableTableHead>
              <TableHead>{t("商品", "Product")}</TableHead>
              <TableHead>{t("买家", "Buyer")}</TableHead>
              <SortableTableHead column="amount" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>{t("金额", "Amount")}</SortableTableHead>
              <SortableTableHead column="status" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>{t("状态", "Status")}</SortableTableHead>
              <SortableTableHead column="createdAt" currentSort={tc.sortColumn as string} currentDirection={tc.sortDirection} onToggle={(c) => tc.toggleSort(c as keyof OrderItem)}>{t("时间", "Time")}</SortableTableHead>
              <TableHead className="w-[100px]">{t("操作", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("加载中…", "Loading…")}</TableCell></TableRow>
            ) : forbiddenMessage ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{forbiddenMessage}</TableCell></TableRow>
            ) : tc.pagedData.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("暂无订单", "No orders yet")}</TableCell></TableRow>
            ) : (
              tc.pagedData.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="w-[40px]">
                    <Checkbox checked={tc.selectedIds.has(order.id)} onCheckedChange={() => tc.toggleSelect(order.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.orderNo}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{order.workTitle}</TableCell>
                  <TableCell>
                    <div className="text-sm">{order.buyerEmail}</div>
                    {order.buyerName && <div className="text-xs text-muted-foreground">{order.buyerName}</div>}
                  </TableCell>
                  <TableCell>{order.amount > 0 ? `¥${order.amount}` : t("开源", "Open Source")}</TableCell>
                  <TableCell>
                    <Badge variant={statusMap[order.status]?.variant || "default"}>
                      {statusMap[order.status]?.label || order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN")}{" "}
                    {new Date(order.createdAt).toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={actionLoading === order.id}>
                          {actionLoading === order.id ? "…" : "•••"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {order.status === "PENDING" && (
                          <DropdownMenuItem onClick={() => updateStatus(order.id, "PAID")}>
                            <i className="ri-checkbox-circle-line mr-2" />{t("标记已支付", "Mark Paid")}
                          </DropdownMenuItem>
                        )}
                        {order.status === "PENDING" && <DropdownMenuSeparator />}
                        {order.status === "PENDING" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ orderId: order.id, orderNo: order.orderNo, action: "CANCELLED" })}>
                            <i className="ri-close-circle-line mr-2" />{t("取消订单", "Cancel Order")}
                          </DropdownMenuItem>
                        )}
                        {order.status === "PAID" && (
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ orderId: order.id, orderNo: order.orderNo, action: "REFUNDED" })}>
                            <i className="ri-refund-2-line mr-2" />{t("退款", "Refund")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ orderId: order.id, orderNo: order.orderNo, action: "DELETE" })}>
                          <i className="ri-delete-bin-line mr-2" />{t("删除订单", "Delete Order")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {tc.totalItems > 0 && (
          <TablePagination page={tc.page} pageSize={tc.pageSize} totalItems={tc.totalItems} totalPages={tc.totalPages} onPageChange={tc.setPage} onPageSizeChange={tc.setPageSize} />
        )}
      </div>

      <ConfirmActionDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.action === "DELETE"
            ? t("确认删除订单", "Confirm Order Deletion")
            : confirmAction?.action === "CANCELLED"
              ? t("确认取消订单", "Confirm Order Cancellation")
              : t("确认退款", "Confirm Refund")
        }
        description={
          confirmAction?.action === "DELETE"
            ? t(`确定要删除订单 ${confirmAction.orderNo} 吗？删除后不可恢复。`, `Delete order ${confirmAction.orderNo}? This action cannot be undone.`)
            : confirmAction?.action === "CANCELLED"
              ? t(`确定要取消订单 ${confirmAction.orderNo} 吗？此操作不可撤销。`, `Cancel order ${confirmAction.orderNo}? This action cannot be undone.`)
              : confirmAction
                ? t(`确定要对订单 ${confirmAction.orderNo} 执行退款吗？此操作不可撤销。`, `Refund order ${confirmAction.orderNo}? This action cannot be undone.`)
                : ""
        }
        confirmLabel={
          confirmAction?.action === "DELETE"
            ? t("确认删除", "Confirm Delete")
            : confirmAction?.action === "CANCELLED"
              ? t("确认取消", "Confirm Cancel")
              : t("确认退款", "Confirm Refund")
        }
        loading={!!confirmAction && actionLoading === confirmAction.orderId}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmAction) return
          if (confirmAction.action === "DELETE") {
            await deleteOrder(confirmAction.orderId)
          } else {
            await updateStatus(confirmAction.orderId, confirmAction.action)
          }
          setConfirmAction(null)
        }}
      />
    </div>
  )
}
