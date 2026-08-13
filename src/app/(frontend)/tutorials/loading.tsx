export default function TutorialsLoading() {
  return (
    <div className="animate-pulse px-6 md:px-12 lg:px-16 py-12 pb-28 lg:pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <div className="h-3 w-10 bg-muted rounded" />
        <div className="h-3 w-3 bg-muted rounded" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>

      {/* Title */}
      <div className="mb-8">
        <div className="h-10 w-48 bg-muted rounded mb-3" />
        <div className="h-4 w-64 bg-muted rounded" />
      </div>

      {/* Masonry cards */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="break-inside-avoid mb-5 rounded-xl border border-border/50 bg-card/50 overflow-hidden">
            <div className="aspect-[3/4] bg-muted relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-muted-foreground/10" />
              </div>
            </div>
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
