/**
 * Dithered placeholders.
 *
 * These pages are server-rendered and read the chain on every request, so a tab change waits on a
 * round trip before anything paints. Without a skeleton that shows as a frozen page and reads as a
 * broken link rather than a slow one.
 *
 * The shimmer is a halftone sweep rather than the usual grey gradient, so loading looks like the
 * rest of the site instead of a bootstrap default.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`skeleton bg-raised ${className ?? ""}`}
      style={{
        WebkitMaskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
        maskImage: "radial-gradient(circle at 1px 1px, #000 0.9px, transparent 0)",
        WebkitMaskSize: "3px 3px",
        maskSize: "3px 3px",
      }}
    />
  );
}

/** Page heading plus the freshness banner, which every data screen opens with. */
export function PageHeaderSkeleton() {
  return (
    <>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <Skeleton className="mt-8 h-16 w-full" />
    </>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className="panel p-7 sm:p-9">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-10 w-48" />
      <Skeleton className={`mt-8 w-full ${height}`} />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border border-edge">
      <div className="border-b border-edge p-5">
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-edge/60 p-5 last:border-0">
          <Skeleton className="h-4 w-6 shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
