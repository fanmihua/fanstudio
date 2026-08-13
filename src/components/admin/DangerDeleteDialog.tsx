"use client"

import { useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DANGER_DELETE_CONFIRM_TEXT,
  buildDangerDeleteMessage,
} from "@/lib/admin-delete-guard"
import { useAdminUiLocale } from "@/contexts/AdminUiLocaleContext"

interface DangerDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resourceName: string
  targetName: string
  description?: string
  loading?: boolean
  onConfirm: () => Promise<void> | void
}

export function DangerDeleteDialog({
  open,
  onOpenChange,
  resourceName,
  targetName,
  description,
  loading = false,
  onConfirm,
}: DangerDeleteDialogProps) {
  const { locale } = useAdminUiLocale()
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const [confirmText, setConfirmText] = useState("")
  const canDelete = confirmText === DANGER_DELETE_CONFIRM_TEXT

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setConfirmText("")
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            {t("高风险删除", "Dangerous deletion")}
          </DialogTitle>
          <DialogDescription>
            {buildDangerDeleteMessage(resourceName, targetName)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {description && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
              {description}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("继续删除前，请输入：", "Type this phrase to continue:")}
              <span className="ml-1 font-mono font-semibold text-foreground">
                {DANGER_DELETE_CONFIRM_TEXT}
              </span>
            </p>
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={DANGER_DELETE_CONFIRM_TEXT}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {t("取消", "Cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canDelete || loading}
          >
            <Trash2 className="mr-2 size-4" />
            {loading ? t("删除中…", "Deleting…") : t("永久删除", "Delete permanently")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
