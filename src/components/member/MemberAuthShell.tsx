import type { CSSProperties, ReactNode } from "react"
import { IcpLink } from "@/components/frontend/IcpLink"

const MEMBER_THEME = {
  "--background": "#f7f7f5",
  "--card": "#ffffff",
  "--card-foreground": "#18181b",
  "--foreground": "#18181b",
  "--primary": "#18181b",
  "--primary-foreground": "#ffffff",
  "--secondary": "#f1f1ef",
  "--secondary-foreground": "#18181b",
  "--muted": "#f1f1ef",
  "--muted-foreground": "#71717a",
  "--accent": "#f4f4f2",
  "--accent-foreground": "#18181b",
  "--border": "#e4e4e7",
  "--input": "#e4e4e7",
  "--ring": "#18181b",
  backgroundColor: "#f7f7f5",
  backgroundImage: "radial-gradient(circle at 1px 1px, rgba(24,24,27,0.045) 1px, transparent 0)",
  backgroundSize: "24px 24px",
} as CSSProperties

export function MemberPageBg({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-screen text-foreground ${className}`} style={MEMBER_THEME}>
      {children}
    </div>
  )
}

export function MemberAuthShell({
  children,
  width = "sm",
  back,
}: {
  children: ReactNode
  width?: "sm" | "md"
  back?: ReactNode
}) {
  return (
    <MemberPageBg className="flex flex-col px-4 py-10">
      <div className="flex flex-1 items-center justify-center">
        <div className={`relative z-10 w-full ${width === "md" ? "max-w-md" : "max-w-sm"}`}>
          {back ? <div className="mb-3">{back}</div> : null}
          <div
            className="rounded-2xl border bg-card"
            style={{ boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 18px 44px -22px rgba(24,24,27,.26)" }}
          >
            <div className="p-7 sm:p-8">{children}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 pt-8 text-xs text-muted-foreground">
        <span>{"Fan's Studio"}</span>
        <span aria-hidden="true">·</span>
        <IcpLink className="transition-colors hover:text-foreground" />
      </div>
    </MemberPageBg>
  )
}
