"use client"
/** 点击触发、确认后执行回调的 Popover，用于批量删除等二次确认。 */
import { useState, useCallback } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface ConfirmPopoverProps {
  /** Popover title */
  title: string
  /** Optional description below title */
  description?: string
  /** Confirm button text, defaults to "确认" */
  confirmText?: string
  /** Cancel button text, defaults to "取消" */
  cancelText?: string
  /** Confirm button variant */
  variant?: "destructive" | "default"
  /** Called when user confirms */
  onConfirm: () => void | Promise<void>
  /** Trigger element */
  children: React.ReactNode
  /** Control open state from outside (optional) */
  open?: boolean
  /** Called when open state changes (optional) */
  onOpenChange?: (open: boolean) => void
  /** Popover alignment */
  align?: "start" | "center" | "end"
  /** Popover side */
  side?: "top" | "right" | "bottom" | "left"
}

export function ConfirmPopover({
  title,
  description,
  confirmText,
  cancelText,
  variant = "destructive",
  onConfirm,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  align = "center",
  side = "bottom",
}: ConfirmPopoverProps) {
  const { locale } = useAdminUiLocale()
  const resolvedConfirmText = confirmText ?? (locale === "en" ? "Confirm" : "确认")
  const resolvedCancelText = cancelText ?? (locale === "en" ? "Cancel" : "取消")
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = useCallback(
    (v: boolean) => {
      if (isControlled) {
        controlledOnOpenChange?.(v)
      } else {
        setInternalOpen(v)
      }
    },
    [isControlled, controlledOnOpenChange]
  )

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-auto max-w-[280px] p-4"
      >
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        <div className="flex justify-end gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            {resolvedCancelText}
          </Button>
          <Button
            variant={variant}
            size="sm"
            className="h-7 text-xs"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && <i className="ri-loader-4-line animate-spin mr-1" />}
            {resolvedConfirmText}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
