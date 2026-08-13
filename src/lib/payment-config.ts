export type PaymentConfig = {
  wechatAppId?: string
  wechatMchId?: string
  wechatApiKey?: string
  wechatSerialNo?: string
  wechatPrivateKey?: string
  wechatCert?: string
  wechatNotifyUrl?: string
}

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath)
}

async function readFileText(filePath: string): Promise<string> {
  const { readFile } = await import("fs/promises")
  return readFile(filePath, "utf8")
}

function resolveRelativePemPath(filePath: string, kind: "privateKey" | "cert"): string | null {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.?\//, "")
  if (kind === "privateKey" && (normalized === "cert/apiclient_key.pem" || normalized === "apiclient_key.pem")) {
    return "cert/apiclient_key.pem"
  }
  if (kind === "cert" && (normalized === "cert/apiclient_cert.pem" || normalized === "apiclient_cert.pem")) {
    return "cert/apiclient_cert.pem"
  }
  return null
}

/** 从项目根相对路径读取 PEM 文件内容，失败返回 ""。 */
async function readPemFromPath(filePath: string, kind: "privateKey" | "cert"): Promise<string> {
  if (!filePath?.trim()) return ""
  try {
    const resolvedPath = isAbsolutePath(filePath)
      ? filePath
      : resolveRelativePemPath(filePath, kind)
    if (!resolvedPath) return ""
    const content = await readFileText(resolvedPath)
    return content?.trim() ?? ""
  } catch {
    return ""
  }
}

/** 从环境变量及可选证书路径读取支付配置。 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  let wechatPrivateKey = process.env.WECHAT_PAY_PRIVATE_KEY || ""
  let wechatCert = process.env.WECHAT_PAY_CERT || ""
  const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH?.trim()
  const certPath = process.env.WECHAT_PAY_CERT_PATH?.trim()
  if (!wechatPrivateKey && privateKeyPath) {
    wechatPrivateKey = await readPemFromPath(privateKeyPath, "privateKey")
  }
  if (!wechatCert && certPath) {
    wechatCert = await readPemFromPath(certPath, "cert")
  }

  return {
    wechatAppId: process.env.WECHAT_APP_ID || "",
    wechatMchId: process.env.WECHAT_PAY_MCH_ID || "",
    wechatApiKey: process.env.WECHAT_PAY_API_KEY || "",
    wechatSerialNo: process.env.WECHAT_PAY_SERIAL_NO || "",
    wechatPrivateKey,
    wechatCert,
    wechatNotifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || "",
  }
}
