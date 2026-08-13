/** 公开 API 用：剔除作品/版本中的交付链接等敏感字段，未购买用户不可见。 */
/* eslint-disable @typescript-eslint/no-unused-vars */

export function sanitizeWorkForPublic<T extends Record<string, unknown>>(
  work: T,
): Omit<T, "figmaUrl" | "deliveryUrl" | "fileUrl" | "fileName"> {
  const { figmaUrl, deliveryUrl, fileUrl, fileName, ...safe } = work
  return safe as Omit<T, "figmaUrl" | "deliveryUrl" | "fileUrl" | "fileName">
}

export function sanitizeVersionForPublic<T extends Record<string, unknown>>(
  version: T,
): Omit<T, "figmaUrl" | "deliveryUrl" | "fileUrl" | "fileName"> {
  const { figmaUrl, deliveryUrl, fileUrl, fileName, ...safe } = version
  return safe as Omit<T, "figmaUrl" | "deliveryUrl" | "fileUrl" | "fileName">
}
