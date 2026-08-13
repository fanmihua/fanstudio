/** 微信支付 V3：从 PaymentConfig 创建 WxPay 实例，用于 Native 下单与回调解密。 */
import WxPay from "wechatpay-node-v3"
import type { PaymentConfig } from "@/lib/payment-config"

function bufferFromPem(pem: string): Buffer {
  return Buffer.from(pem.trim(), "utf8")
}

/** 从配置创建 WxPay 实例（Native 统一下单）。缺少必要配置时返回 null。 */
export function createWxPayFromConfig(config: PaymentConfig): WxPay | null {
  const appid = config.wechatAppId?.trim()
  const mchid = config.wechatMchId?.trim()
  const privateKey = config.wechatPrivateKey?.trim()
  const cert = config.wechatCert?.trim()
  if (!appid || !mchid || !privateKey || !cert) return null

  try {
    const publicKey = bufferFromPem(cert)
    const privateKeyBuf = bufferFromPem(privateKey)
    const options: { serial_no?: string; key?: string } = {}
    if (config.wechatSerialNo?.trim()) options.serial_no = config.wechatSerialNo.trim()
    if (config.wechatApiKey?.trim()) options.key = config.wechatApiKey.trim()

    return new WxPay({
      appid,
      mchid,
      publicKey,
      privateKey: privateKeyBuf,
      ...options,
    }) as WxPay
  } catch {
    return null
  }
}

/**
 * 仅用于回调解密与验签的配置（不需要证书，需要 APIv3 密钥）。
 */
export function getNotifyConfig(config: PaymentConfig): { key: string; pay: WxPay } | null {
  const key = config.wechatApiKey?.trim()
  const mchid = config.wechatMchId?.trim()
  const cert = config.wechatCert?.trim()
  const privateKey = config.wechatPrivateKey?.trim()
  const appid = config.wechatAppId?.trim()
  if (!key || !mchid || !cert || !privateKey || !appid) return null

  try {
    const pay = new WxPay({
      appid,
      mchid,
      publicKey: bufferFromPem(cert),
      privateKey: bufferFromPem(privateKey),
      key: key,
    }) as WxPay
    return { key, pay }
  } catch {
    return null
  }
}
