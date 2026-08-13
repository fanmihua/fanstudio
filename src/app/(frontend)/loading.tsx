export default function FrontendLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <section className="min-h-[85vh] flex flex-col justify-center px-6 md:px-12 lg:px-16 py-20">
        <div className="h-5 w-32 bg-muted rounded mb-4" />
        <div className="h-12 w-64 bg-muted rounded mb-3" />
        <div className="h-4 w-80 bg-muted rounded mb-8" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </section>

      {/* Works grid skeleton */}
      <section className="px-6 md:px-12 lg:px-16 py-16 border-t border-border/40">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-40 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="aspect-[3/4] bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Second grid skeleton */}
      <section className="px-6 md:px-12 lg:px-16 py-16 border-t border-border/40">
        <div className="flex items-center justify-between mb-8">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
              <div className="aspect-[3/4] bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
