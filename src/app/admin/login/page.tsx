"use client"
/** 后台登录页：邮箱+密码，Credentials 鉴权。 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminThemeWrapper } from "@/components/admin/AdminThemeWrapper"
import { useUiLocale } from "@/hooks/useUiLocale"

export default function LoginPage() {
  const { locale } = useUiLocale("zh")
  const t = (zh: string, en: string) => (locale === "en" ? en : zh)
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t("邮箱或密码错误", "Invalid email or password"))
      } else {
        router.push("/admin")
        router.refresh()
      }
    } catch {
      setError(t("登录失败，请重试", "Login failed, please try again"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminThemeWrapper>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="fixed inset-0 pointer-events-none grid-bg opacity-[0.03]" />
        <Card className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="font-serif text-2xl font-bold tracking-tight">
              {t("后台登录", "Admin Sign In")}
            </CardTitle>
            <CardDescription>{t("请输入您的账号和密码", "Enter your account and password")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("邮箱", "Email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("密码", "Password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"} />
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("登录中...", "Signing in...") : t("登录", "Sign In")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminThemeWrapper>
  )
}
