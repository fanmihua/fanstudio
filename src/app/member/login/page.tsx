"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { MemberAuthShell } from "@/components/member/MemberAuthShell"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DOMAINS = ["qq.com", "163.com", "126.com", "gmail.com", "outlook.com", "foxmail.com", "sina.com"]

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get("next") || "/member"

  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sugOpen, setSugOpen] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const at = email.indexOf("@")
  const localPart = at >= 0 ? email.slice(0, at) : email
  const dp = at >= 0 ? email.slice(at + 1).toLowerCase() : ""
  const sugList = localPart.trim()
    ? DOMAINS.filter((d) => !dp || (d.startsWith(dp) && d !== dp)).slice(0, 5).map((d) => `${localPart}@${d}`)
    : []

  const emailValid = EMAIL_RE.test(email.trim().toLowerCase())
  const codeValid = /^\d{6}$/.test(code)

  async function sendCode() {
    if (cooldown > 0 || sending) return
    const e = email.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) {
      toast.error("请输入有效的邮箱地址")
      return
    }
    setSending(true)
    setSugOpen(false)
    try {
      const res = await fetch("/api/member/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "发送失败")
        if (data.retryAfter) {
          setSent(true)
          setCooldown(data.retryAfter)
        }
        return
      }
      setSent(true)
      setCooldown(60)
      if (data.devCode) {
        const dc = String(data.devCode).replace(/\D/g, "").slice(0, 6)
        setCode(dc)
        toast.success("开发模式：验证码已自动填入，正在登录…")
        // dev 自动填的码不走输入事件，这里补一次自动提交（线上靠 onCodeChange 满 6 位自动提交）
        if (dc.length === 6) setTimeout(() => verify(dc), 500)
      } else {
        toast.success("验证码已发送，请查收邮箱")
      }
    } catch {
      toast.error("网络错误，请重试")
    } finally {
      setSending(false)
    }
  }

  async function verify(theCode?: string) {
    const c = theCode ?? code
    if (!EMAIL_RE.test(email.trim().toLowerCase())) {
      toast.error("请输入有效的邮箱地址")
      return
    }
    if (!/^\d{6}$/.test(c)) {
      toast.error("请输入 6 位验证码")
      return
    }
    if (verifying) return
    setVerifying(true)
    try {
      const res = await fetch("/api/member/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: c }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "验证失败")
        return
      }
      toast.success("登录成功")
      router.push(next)
      router.refresh()
    } catch {
      toast.error("网络错误，请重试")
    } finally {
      setVerifying(false)
    }
  }

  function onCodeChange(v: string) {
    setCode(v)
    if (v.length === 6 && sent) verify(v)
  }

  // 「返回」放到卡片外侧（由 MemberAuthShell 渲染在卡上方）
  const backBtn = (
    <button
      type="button"
      onClick={() => router.push(next)}
      className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <i className="ri-arrow-left-line" /> 返回
    </button>
  )

  return (
    <MemberAuthShell back={backBtn}>
      <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">登录 / 注册</h1>

      {!sent ? (
        // —— 第一步：输入邮箱 ——
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">输入邮箱，获取验证码登录</p>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">邮箱</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setSugOpen(true)
                  }}
                  onFocus={() => setSugOpen(true)}
                  onBlur={() => setTimeout(() => setSugOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSugOpen(false)
                      sendCode()
                    }
                  }}
                />
                {sugOpen && sugList.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
                    {sugList.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEmail(s)
                          setSugOpen(false)
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button className="w-full" onClick={() => sendCode()} disabled={!emailValid || sending || cooldown > 0}>
              {sending ? "发送中…" : cooldown > 0 ? `重新发送 (${cooldown}s)` : "发送验证码"}
            </Button>
          </div>
        </>
      ) : (
        // —— 第二步：输入验证码 ——
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">
            验证码已发送至 <span className="font-medium text-foreground">{email.trim().toLowerCase()}</span>
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex items-baseline justify-between">
                <Label>验证码</Label>
                <button
                  type="button"
                  className="text-sm text-[#EF7627] transition-opacity hover:opacity-80 disabled:cursor-default disabled:text-muted-foreground disabled:opacity-100"
                  onClick={() => sendCode()}
                  disabled={sending || cooldown > 0}
                >
                  {sending ? "发送中…" : cooldown > 0 ? `重新发送 (${cooldown}s)` : "重新发送"}
                </button>
              </div>
              <div className="mt-1.5">
                <InputOTP maxLength={6} value={code} onChange={onCodeChange} autoFocus>
                  <InputOTPGroup className="w-full justify-between gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-12 flex-1 rounded-lg border-border bg-white text-lg font-bold"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button className="w-full" onClick={() => verify()} disabled={!codeValid || verifying}>
              {verifying ? "登录中…" : "登录"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setSent(false)
                setCode("")
              }}
              className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← 改用其他邮箱
            </button>

            <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <i className="ri-information-line mr-1 align-[-1px]" />
              没收到验证码?邮件可能被归入<span className="font-medium text-foreground/80">垃圾邮件 / 订阅邮件 / 推广</span>文件夹,麻烦去那儿看看;等 1–2 分钟仍未收到,可点上方「重新发送」。
            </p>
          </div>
        </>
      )}
    </MemberAuthShell>
  )
}

export default function MemberLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  )
}
