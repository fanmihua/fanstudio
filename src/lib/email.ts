/** 订单/交付邮件发送（Nodemailer SMTP）。未配置 SMTP_HOST 时静默跳过。 */
import nodemailer from "nodemailer8"
import type { Transporter } from "nodemailer8"

let transporter: Transporter | null = null

/** 获取或创建 SMTP transporter，未配置则返回 null。 */
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim()
  if (!host) return null

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    })
  }
  return transporter
}

const FROM_ADDRESS = process.env.EMAIL_FROM || process.env.SMTP_USER || ""
const SUPPORT_WECHAT = process.env.SUPPORT_WECHAT?.trim() || ""
const EMAIL_PRIDE_COLORS = ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"]

const PAPER_EMAIL = {
  pageBg: "#f7f4ec",
  cardBg: "#fffdf8",
  text: "#16161d",
  muted: "#7d7d88",
  subtle: "#9a9aa3",
  border: "#e8e2d7",
  codeBg: "#faf8f3",
  accentBg: "#fff0e8",
  accentText: "#e85d1c",
  logoBg: "#fff7f1",
  buttonBg: "#16161d",
  buttonText: "#ffffff",
}

function buildPlainText(lines: Array<string | number | null | undefined>): string {
  return lines
    .filter((line) => line !== null && line !== undefined && String(line).trim().length > 0)
    .map((line) => String(line).trim())
    .join("\n")
}

function parseUpgradeCredit(note?: string | null): number {
  const match = note?.match(/抵扣\s*¥\s*(\d+(?:\.\d+)?)/)
  const value = match ? Number(match[1]) : 0
  return Number.isFinite(value) ? value : 0
}

function buildPrideStripe(): string {
  return `
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${EMAIL_PRIDE_COLORS.map((color) => `<td width="14.28%" style="height:7px; background-color:${color}; font-size:0; line-height:0;">&nbsp;</td>`).join("")}
                </tr>
              </table>
            </td>
          </tr>`
}

function buildEmailDetails(rows: [string, string][]): string {
  if (rows.length === 0) return ""
  return `
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${PAPER_EMAIL.border}; border-bottom:1px solid ${PAPER_EMAIL.border}; padding:11px 0;">
                ${rows.map(([label, value]) => `
                  <tr>
                    <td style="padding:7px 0; font-size:13px; color:${PAPER_EMAIL.muted};">${escapeEmailHtml(label)}</td>
                    <td align="right" style="padding:7px 0; font-size:13px; color:${PAPER_EMAIL.text}; font-weight:600;">${escapeEmailHtml(value)}</td>
                  </tr>
                `).join("")}
              </table>
            </td>
          </tr>`
}

function buildEmailButton(url: string | null | undefined, label: string): string {
  if (!url) return ""
  return `
          <tr>
            <td align="center" style="padding:22px 32px 6px;">
              <a href="${escapeEmailHtml(url)}" style="display:inline-block; padding:12px 26px; border-radius:8px; background-color:${PAPER_EMAIL.buttonBg}; color:${PAPER_EMAIL.buttonText}; font-size:14px; font-weight:700; text-decoration:none;">${escapeEmailHtml(label)} &rarr;</a>
            </td>
          </tr>`
}

function supportPlainText(wechat = SUPPORT_WECHAT): string {
  return wechat
    ? `登录或访问遇到问题，可加微信 ${wechat} 联系站点管理员。`
    : "登录或访问遇到问题，请联系站点管理员。"
}

function buildSupportFooter(wechat = SUPPORT_WECHAT): string {
  const message = wechat
    ? `登录或访问遇到问题，可加微信 <span style="color:${PAPER_EMAIL.text}; font-weight:700;">${escapeEmailHtml(wechat)}</span> 联系站点管理员。`
    : "登录或访问遇到问题，请联系站点管理员。"
  return `
          <tr>
            <td align="center" style="padding:20px 32px 30px;">
              <p style="margin:0; color:${PAPER_EMAIL.muted}; font-size:12px; line-height:1.7;">${message}</p>
            </td>
          </tr>`
}

function buildPaperEmail(p: {
  siteName: string
  label?: string
  heading: string
  lead?: string
  contentHtml?: string
  footerHtml?: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0; padding:0; background-color:${PAPER_EMAIL.pageBg}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER_EMAIL.pageBg}; padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; overflow:hidden; border-radius:18px; border:1px solid ${PAPER_EMAIL.border}; background-color:${PAPER_EMAIL.cardBg};">
          ${buildPrideStripe()}
          <tr>
            <td style="padding:30px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:20px; font-weight:700; color:${PAPER_EMAIL.text};">${escapeEmailHtml(p.siteName)}</p>
                  </td>
                  <td align="right">
                    <span style="display:inline-block; padding:7px 10px; border-radius:999px; background-color:${PAPER_EMAIL.logoBg}; color:${PAPER_EMAIL.accentText}; font-size:12px; font-weight:700;">STUDIO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${p.label ? `
          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <div style="display:inline-block; padding:8px 12px; border-radius:999px; background-color:${PAPER_EMAIL.accentBg}; color:${PAPER_EMAIL.accentText}; font-size:12px; font-weight:700;">${escapeEmailHtml(p.label)}</div>
            </td>
          </tr>` : ""}
          <tr>
            <td align="center" style="padding:${p.label ? "6px" : "30px"} 32px 8px;">
              <h1 style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:28px; line-height:1.18; font-weight:700; color:${PAPER_EMAIL.text};">${escapeEmailHtml(p.heading)}</h1>
            </td>
          </tr>
          ${p.lead ? `
          <tr>
            <td align="center" style="padding:0 34px 20px;">
              <p style="margin:0; color:${PAPER_EMAIL.muted}; font-size:14px; line-height:1.7;">${escapeEmailHtml(p.lead)}</p>
            </td>
          </tr>` : ""}
          ${p.contentHtml ?? ""}
          ${p.footerHtml ?? buildSupportFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

interface OrderEmailParams {
  to: string
  siteName: string
  workTitle: string
  orderNo: string
  locale?: "zh" | "en"
  isFree: boolean
  amount?: number
  figmaUrl?: string | null
  deliveryUrl?: string | null
  currentVersion?: string | null
  wechat?: string | null
}

/** 解析 data URL 为 Buffer 与 contentType。 */
function parseDataUrl(
  dataUrl: string,
): { buffer: Buffer; contentType: string; ext: string } | null {
  const match = dataUrl.match(/^data:(image\/(\w+));base64,(.+)$/)
  if (!match) return null
  return {
    contentType: match[1],
    ext: match[2] === "jpeg" ? "jpg" : match[2],
    buffer: Buffer.from(match[3], "base64"),
  }
}

/** 发送订单确认/交付邮件。 */
export async function sendOrderEmail(params: OrderEmailParams) {
  const smtp = getTransporter()
  if (!smtp) {
    console.log("[Email] SMTP 未配置，跳过发送邮件")
    return
  }

  const {
    to,
    siteName,
    workTitle,
    orderNo,
    locale = "zh",
    isFree,
    amount,
    figmaUrl,
    deliveryUrl,
    currentVersion,
    wechat,
  } = params

  const subject = locale === "en"
    ? (isFree ? `${workTitle} - Resource Ready` : `${workTitle} - Payment Success`)
    : (isFree ? `${workTitle} - 资源已就绪` : `${workTitle} - 赞助成功`)

  const deliverySection = buildDeliverySection(figmaUrl, deliveryUrl)
  const versionText = currentVersion ? ` V${currentVersion}` : ""

  const isWechatImage = wechat?.startsWith("data:image")
  const wechatSection = buildWechatSection(wechat, isWechatImage)

  // 构建 Nodemailer 附件（内联图片使用 cid）
  const attachments: {
    filename: string
    content: Buffer
    contentType: string
    cid: string
  }[] = []
  if (wechat && isWechatImage) {
    const parsed = parseDataUrl(wechat)
    if (parsed) {
      attachments.push({
        filename: `wechat-qr.${parsed.ext}`,
        content: parsed.buffer,
        contentType: parsed.contentType,
        cid: "wechat-qr",
      })
    }
  }

  const html = buildHtml({
    siteName,
    workTitle,
    orderNo,
    isFree,
    amount,
    versionText,
    deliverySection,
    wechatSection,
    wechat,
  })
  const text = buildPlainText([
    isFree ? "资源已就绪" : "赞助成功",
    workTitle,
    `订单号：${orderNo}`,
    amount != null && !isFree ? `金额：¥${amount}` : null,
    currentVersion ? `版本：V${currentVersion}` : null,
    figmaUrl ? `Figma：${figmaUrl}` : null,
    deliveryUrl ? `下载/交付链接：${deliveryUrl}` : null,
    wechat && !isWechatImage ? `微信：${wechat}` : null,
  ])

  try {
    const result = await smtp.sendMail({
      from: `${siteName} <${FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
      attachments,
    })
    console.log("[Email] 邮件已发送:", result.messageId)
  } catch (err) {
    console.error("[Email] 发送失败:", err)
  }
}

/** 退款通知邮件参数。 */
export interface RefundEmailParams {
  to: string
  siteName: string
  workTitle: string
  orderNo: string
  amount: number
}

/** 发送退款通知邮件。 */
export async function sendRefundEmail(params: RefundEmailParams) {
  const smtp = getTransporter()
  if (!smtp) {
    console.log("[Email] SMTP 未配置，跳过发送退款邮件")
    return
  }
  const { to, siteName, workTitle, orderNo, amount } = params
  const subject = `${workTitle} - 赞助已返还`
  const html = buildRefundHtml({ siteName, workTitle, orderNo, amount })
  const text = buildPlainText([
    "赞助已返还",
    workTitle,
    `订单号：${orderNo}`,
    `返还金额：¥${amount.toFixed(2)}`,
    "款项将原路退回，到账时间以支付渠道为准。",
  ])
  try {
    const result = await smtp.sendMail({
      from: `${siteName} <${FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
    })
    console.log("[Email] 退款邮件已发送:", result.messageId)
  } catch (err) {
    console.error("[Email] 退款邮件发送失败:", err)
  }
}

/** 会员登录验证码邮件参数。 */
export interface VerificationCodeEmailParams {
  to: string
  siteName: string
  code: string
  ttlMinutes?: number
}

/** 发送会员登录验证码邮件。未配置 SMTP 时静默跳过并返回 false。 */
export async function sendVerificationCodeEmail(
  params: VerificationCodeEmailParams,
): Promise<boolean> {
  const smtp = getTransporter()
  if (!smtp) {
    console.log("[Email] SMTP 未配置，跳过发送验证码")
    return false
  }
  const { to, siteName, code, ttlMinutes = 10 } = params
  const subject = `${code} 是你的登录验证码 · ${siteName}`
  const html = buildCodeHtml({ siteName, code, ttlMinutes })
  const text = buildPlainText([
    `${siteName} 登录验证码`,
    `验证码：${code}`,
    `有效期：${ttlMinutes} 分钟`,
    "如果不是你本人操作，忽略此邮件即可。",
    supportPlainText(),
  ])
  try {
    const result = await smtp.sendMail({
      from: `${siteName} <${FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
    })
    console.log("[Email] 验证码邮件已发送:", result.messageId)
    return true
  } catch (err) {
    console.error("[Email] 验证码发送失败:", err)
    return false
  }
}

function buildCodeHtml(p: {
  siteName: string
  code: string
  ttlMinutes: number
}): string {
  return buildPaperEmail({
    siteName: p.siteName,
    label: "登录验证码",
    heading: "登录验证码",
    lead: "在登录页输入下面的验证码。10 分钟内有效，请勿泄露给他人。",
    contentHtml: `
          <tr>
            <td align="center" style="padding:10px 32px 10px;">
              <div style="display:inline-block; padding:16px 26px; border-radius:12px; border:1px solid ${PAPER_EMAIL.border}; background-color:${PAPER_EMAIL.codeBg}; color:${PAPER_EMAIL.text}; font-family:Menlo,Consolas,'SF Mono',monospace; font-size:34px; font-weight:700; letter-spacing:9px; user-select:all;">${escapeEmailHtml(p.code)}</div>
            </td>
          </tr>
          ${buildEmailDetails([["用途", "邮箱验证码登录"], ["有效期", `${p.ttlMinutes} 分钟`]])}`,
  })
}

/** 会员开通/续期通知邮件参数（赠送与付费统一；产品名一律用变量，不写死具体产品）。 */
export interface MembershipEmailParams {
  to: string
  siteName: string
  productName: string          // 产品名（变量）
  source: "PURCHASE" | "COMP"  // 付费 / 赠送
  isRenewal: boolean           // 续期/延长(true) 还是首次开通(false)
  isLifetime: boolean
  isLifetimeOrder?: boolean
  accessUntil?: Date | null
  amount?: number              // 仅付费展示金额；赠送不展示
  planName?: string | null
  upgradeCredit?: number | null
  note?: string | null
  grantLabel?: string | null     // 赠送来源标签，如「活动赠送」
  startUrl?: string | null     // 「立即开始 / 继续使用」按钮链接（产品入口完整 URL）
}

/** 发送会员开通/续期通知邮件。4 套文案：来源(赠送/付费) × 动作(首次/续期)。未配置 SMTP 静默跳过。 */
export async function sendMembershipEmail(params: MembershipEmailParams): Promise<boolean> {
  const smtp = getTransporter()
  if (!smtp) {
    console.log("[Email] SMTP 未配置，跳过会员通知邮件")
    return false
  }
  const {
    to,
    siteName,
    productName,
    source,
    isRenewal,
    isLifetime,
    isLifetimeOrder,
    accessUntil,
    amount,
    planName,
    upgradeCredit,
    note,
    grantLabel,
    startUrl,
  } = params
  const isComp = source === "COMP"
  const displayGrantLabel = isComp ? grantLabel?.trim() || null : null
  const purchasedLifetime = isLifetimeOrder ?? isLifetime
  const isLifetimeUpgrade = !isComp && purchasedLifetime && isRenewal
  const credit = Math.max(0, Math.floor(Number(upgradeCredit ?? parseUpgradeCredit(note))))
  const displayNote = isLifetimeUpgrade && note?.includes("抵扣") ? null : note?.trim() || null

  const validText = isLifetime
    ? "已开通"
    : accessUntil
      ? `${isRenewal ? "现有效期至" : "有效期至"} ${accessUntil.toISOString().slice(0, 10)}`
      : ""

  const subject = isComp
    ? (displayGrantLabel
        ? `${productName} ${isRenewal ? `${displayGrantLabel}已延长` : `${displayGrantLabel}已开通`} · ${siteName}`
        : (isRenewal ? `${productName} 有效期已延长 · ${siteName}` : `${productName} 已为你开通 · ${siteName}`))
    : isLifetimeUpgrade
      ? `${productName} 通行权益已开通 · ${siteName}`
      : (isRenewal ? `${productName} 续期成功 · ${siteName}` : `${productName} 开通成功 · ${siteName}`)
  const icon = isComp ? "赠" : "通"
  const heading = isComp
    ? (displayGrantLabel ? `${displayGrantLabel}${isRenewal ? "已延长" : "已开通"}` : (isRenewal ? "有效期已延长" : "已为你开通"))
    : isLifetimeUpgrade
      ? "通行权益已开通"
      : (isRenewal ? "续期成功" : "开通成功")
  const body = isComp
    ? (displayGrantLabel
        ? (isRenewal ? `已为你延长 ${productName} 的${displayGrantLabel}。` : `${siteName} 已为你开通${displayGrantLabel}，用本邮箱登录即可开始使用。`)
        : (isRenewal ? `已为你延长 ${productName} 有效期。` : `${siteName} 为你开通了 ${productName}，用本邮箱登录即可开始。`))
    : isLifetimeUpgrade
      ? (credit > 0 ? `你已拥有 ${productName} 通行权益，本次已按未使用的付费通行期自动抵扣。` : `你已拥有 ${productName} 通行权益。`)
      : (isRenewal ? "本次购买的通行时长已顺延到当前有效期之后。" : `你的 ${productName} 已开通，用本邮箱登录即可开始。`)
  const btnText = isLifetimeUpgrade ? "进入产品" : isRenewal ? "继续使用" : "立即开始"
  const detailTextRows = [
    ["产品", productName],
    displayGrantLabel ? ["开通方式", displayGrantLabel] : null,
    planName ? ["套餐", planName] : null,
    validText ? ["权益", validText] : null,
    !isComp && amount != null ? [isLifetimeUpgrade ? "实付金额" : "支付金额", `¥${amount}`] : null,
    credit > 0 ? ["抵扣金额", `¥${credit}`] : null,
    displayNote ? ["备注", displayNote] : null,
  ].filter(Boolean) as [string, string][]

  const html = buildMembershipHtml({
    siteName, productName, validText, icon, heading, body, btnText,
    grantLabel: displayGrantLabel,
    startUrl: startUrl ?? null,
    amount: isComp ? null : (amount ?? 0),
    planName: planName ?? null,
    upgradeCredit: credit > 0 ? credit : null,
    note: displayNote,
    isLifetimeUpgrade,
  })
  const text = buildPlainText([
    `${productName} · ${heading}`,
    body,
    ...detailTextRows.map(([label, value]) => `${label}：${value}`),
    startUrl ? `${btnText}：${startUrl}` : null,
    supportPlainText(),
  ])
  try {
    const result = await smtp.sendMail({ from: `${siteName} <${FROM_ADDRESS}>`, to, subject, text, html })
    console.log("[Email] 会员通知邮件已发送:", result.messageId)
    return true
  } catch (err) {
    console.error("[Email] 会员通知邮件发送失败:", err)
    return false
  }
}

function buildMembershipHtml(p: {
  siteName: string
  productName: string
  validText: string
  icon: string
  heading: string
  body: string
  btnText: string
  startUrl: string | null
  amount: number | null
  planName: string | null
  upgradeCredit: number | null
  note: string | null
  grantLabel: string | null
  isLifetimeUpgrade: boolean
}): string {
  const detailRows = [
    ["产品", p.productName],
    p.grantLabel ? ["开通方式", p.grantLabel] : null,
    p.planName ? ["套餐", p.planName] : null,
    p.validText ? ["权益", p.validText] : null,
    p.amount != null ? [p.isLifetimeUpgrade ? "实付金额" : "支付金额", `¥${p.amount}`] : null,
    p.upgradeCredit != null ? ["抵扣金额", `¥${p.upgradeCredit}`] : null,
    p.note ? ["备注", p.note] : null,
  ].filter(Boolean) as [string, string][]
  return buildPaperEmail({
    siteName: p.siteName,
    label: p.heading,
    heading: p.heading,
    lead: [p.productName, p.grantLabel, p.validText].filter(Boolean).join(" · "),
    contentHtml: `
          ${buildEmailDetails(detailRows)}
          <tr>
            <td style="padding:${detailRows.length ? "14px" : "4px"} 32px 0;">
              <p style="margin:0; font-size:13px; color:${PAPER_EMAIL.muted}; line-height:1.7;">${escapeEmailHtml(p.body)}</p>
            </td>
          </tr>
          ${buildEmailButton(p.startUrl, p.btnText)}`,
  })
}

/** 留言板通知邮件参数。 */
export interface GuestbookNotifyParams {
  siteName: string
  nickname: string
  content: string
  isReply: boolean
  url?: string
  to?: string
}

/** 有人留言/回复时通知站长。未配置 SMTP 或无收件人时静默跳过，永不抛错。 */
export async function sendGuestbookNotifyEmail(params: GuestbookNotifyParams) {
  const smtp = getTransporter()
  if (!smtp) {
    console.log("[Email] SMTP 未配置，跳过留言通知")
    return
  }
  const to = params.to || FROM_ADDRESS
  if (!to) {
    console.log("[Email] 无收件地址，跳过留言通知")
    return
  }
  const { siteName, nickname, content, isReply, url } = params
  const subject = isReply ? `${siteName} · 有人回复了留言` : `${siteName} · 收到一条新留言`
  const html = buildGuestbookHtml({ siteName, nickname, content, isReply, url })
  const text = buildPlainText([
    isReply ? "有人回复了留言" : "收到一条新留言",
    `来自：${nickname}`,
    content,
    url ? `查看：${url}` : null,
  ])
  try {
    const result = await smtp.sendMail({
      from: `${siteName} <${FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
    })
    console.log("[Email] 留言通知已发送:", result.messageId)
  } catch (err) {
    console.error("[Email] 留言通知发送失败:", err)
  }
}

/** HTML 转义（邮件正文展示用户内容，换行转 <br>）。 */
function escapeEmailHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br />")
}

function buildGuestbookHtml(p: {
  siteName: string
  nickname: string
  content: string
  isReply: boolean
  url?: string
}): string {
  const title = p.isReply ? "有人回复了留言" : "收到一条新留言"
  return buildPaperEmail({
    siteName: p.siteName,
    label: "来坐坐留言",
    heading: title,
    lead: `来自 ${p.nickname}`,
    contentHtml: `
          <tr>
            <td style="padding:0 32px 8px;">
              <div style="border-top:1px solid ${PAPER_EMAIL.border}; border-bottom:1px solid ${PAPER_EMAIL.border}; padding:18px 0; font-size:15px; line-height:1.75; color:${PAPER_EMAIL.text}; white-space:pre-wrap; word-break:break-word;">${escapeEmailHtml(p.content)}</div>
            </td>
          </tr>
          ${buildEmailButton(p.url, "去来坐坐看看")}`,
    footerHtml: `
          <tr>
            <td style="padding:0 32px 30px;"></td>
          </tr>`,
  })
}

function buildRefundHtml(p: {
  siteName: string
  workTitle: string
  orderNo: string
  amount: number
}): string {
  return buildPaperEmail({
    siteName: p.siteName,
    label: "后台通知",
    heading: "赞助已返还",
    lead: p.workTitle,
    contentHtml: `
          ${buildEmailDetails([["赞助编号", p.orderNo], ["返还金额", `¥${p.amount.toFixed(2)}`]])}
          <tr>
            <td style="padding:14px 32px 0;">
              <p style="margin:0; font-size:13px; color:${PAPER_EMAIL.muted}; line-height:1.7;">款项将原路退回，到账时间以支付渠道为准。</p>
            </td>
          </tr>`,
    footerHtml: `
          <tr>
            <td style="padding:0 32px 30px;"></td>
          </tr>`,
  })
}

/* ------------------------------------------------------------------ */
/*  HTML 模板构建                                                      */
/* ------------------------------------------------------------------ */

interface HtmlParams {
  siteName: string
  workTitle: string
  orderNo: string
  isFree: boolean
  amount?: number
  versionText: string
  deliverySection: string
  wechatSection: string
  wechat?: string | null
}

function buildHtml(p: HtmlParams): string {
  const detailRows = [
    ["作品", `${p.workTitle}${p.versionText}`],
    !p.isFree ? ["赞助编号", p.orderNo] : null,
    !p.isFree ? ["支付金额", `¥${p.amount ?? 0}`] : null,
  ].filter(Boolean) as [string, string][]
  return buildPaperEmail({
    siteName: p.siteName,
    label: p.isFree ? "资源已就绪" : "赞助成功",
    heading: p.isFree ? "资源已就绪" : "感谢支持",
    lead: p.isFree ? "资源已准备好，可通过下方链接获取。" : "你的赞助已完成，请妥善保管这封邮件。",
    contentHtml: `
          ${buildEmailDetails(detailRows)}
          ${p.deliverySection}
          ${p.wechatSection}`,
    footerHtml: p.wechat ? buildSupportFooter() : `
          <tr>
            <td align="center" style="padding:20px 32px 30px;">
              <p style="margin:0; color:${PAPER_EMAIL.muted}; font-size:12px; line-height:1.7;">如有问题，可联系站点管理员。</p>
            </td>
          </tr>`,
  })
}

function buildDeliverySection(
  figmaUrl?: string | null,
  deliveryUrl?: string | null,
): string {
  if (!figmaUrl && !deliveryUrl) return ""

  let buttons = ""

  if (figmaUrl) {
    buttons += `
      <tr>
        <td style="padding:0 0 12px;">
          <a href="${escapeEmailHtml(figmaUrl)}" target="_blank" style="display:block; padding:14px; border-radius:8px; background-color:${PAPER_EMAIL.buttonBg}; color:${PAPER_EMAIL.buttonText}; text-decoration:none; text-align:center; font-size:14px; font-weight:700;">
            直接在 Figma 中打开 &rarr;
          </a>
        </td>
      </tr>`
  }

  if (deliveryUrl) {
    buttons += `
      <tr>
        <td style="padding:0 0 12px;">
          <a href="${escapeEmailHtml(deliveryUrl)}" target="_blank" style="display:block; padding:14px; border-radius:8px; background-color:${PAPER_EMAIL.accentBg}; color:${PAPER_EMAIL.accentText}; text-decoration:none; text-align:center; font-size:14px; font-weight:700; border:1px solid ${PAPER_EMAIL.border};">
            获取源文件 &rarr;
          </a>
        </td>
      </tr>`
  }

  return `
  <tr>
    <td style="padding:20px 32px 8px;">
      <p style="margin:0 0 12px; font-size:13px; color:${PAPER_EMAIL.muted};">获取资源</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${buttons}
      </table>
    </td>
  </tr>`
}

function buildWechatSection(
  wechat?: string | null,
  isImage?: boolean,
): string {
  if (!wechat) return ""

  if (isImage) {
    return `
    <tr>
      <td style="padding:0 32px;">
        <div style="height:1px; background-color:${PAPER_EMAIL.border};"></div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 32px 0;">
        <p style="margin:0 0 12px; font-size:13px; color:${PAPER_EMAIL.muted};">需要帮助？扫码添加微信</p>
        <div style="background-color:#ffffff; border-radius:12px; padding:12px; display:inline-block; border:1px solid ${PAPER_EMAIL.border};">
          <img src="cid:wechat-qr" alt="微信二维码" style="width:140px; height:140px; border-radius:8px; display:block;" />
        </div>
        <p style="margin:10px 0 0; font-size:12px; color:${PAPER_EMAIL.muted};">长按或截图扫码添加</p>
      </td>
    </tr>`
  }

  return `
  <tr>
    <td style="padding:0 32px;">
      <div style="height:1px; background-color:${PAPER_EMAIL.border};"></div>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <p style="margin:0; font-size:13px; color:${PAPER_EMAIL.muted};">需要帮助？添加微信联系我</p>
            <p style="margin:6px 0 0; font-size:15px; color:${PAPER_EMAIL.text}; font-weight:700;">${escapeEmailHtml(wechat)}</p>
          </td>
          <td width="36" style="vertical-align:middle; text-align:right;">
            <div style="width:32px; height:32px; border-radius:8px; background-color:${PAPER_EMAIL.accentBg}; color:${PAPER_EMAIL.accentText}; display:inline-block; text-align:center; line-height:32px; font-size:13px; font-weight:700;">微</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}
