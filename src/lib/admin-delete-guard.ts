export const DANGER_DELETE_CONFIRM_TEXT = "确认删除"

export function isDangerDeleteConfirmed(body: unknown): boolean {
  if (!body || typeof body !== "object") return false
  return (body as { confirmText?: unknown }).confirmText === DANGER_DELETE_CONFIRM_TEXT
}

export function buildDangerDeleteMessage(resourceName: string, targetName: string): string {
  return `删除${resourceName}「${targetName}」不可恢复。上线后删除会影响审计、统计或用户访问记录，请确认你已经理解风险。`
}

export function dangerDeleteError() {
  return { error: `请输入「${DANGER_DELETE_CONFIRM_TEXT}」后再删除` }
}
