// Pulsing placeholder blocks, themed through the same gray scale as the rest
// of the app (so dark mode works with no dark: classes).
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

function CardSkeleton({ rows = 4 }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  )
}

// Mirrors the Dashboard layout so nothing jumps when data arrives.
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="max-w-6xl mx-auto w-full space-y-5 pb-12">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-7 w-2/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-7 w-1/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
