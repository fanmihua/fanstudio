/** 应用版本与作者信息，用于页脚、meta 等。与 package.json version 保持一致。 */
export const APP_VERSION = "0.1.0"
export const APP_AUTHOR = "Your Name"

/** 页脚配置类型（版权文字 + 版本号），后台可自定义 */
export type FooterConfig = {
  copyrightText?: string
  version?: string
}

/** 页脚默认配置 */
export const defaultFooter: FooterConfig = {
  copyrightText: APP_AUTHOR,
  version: APP_VERSION,
}
