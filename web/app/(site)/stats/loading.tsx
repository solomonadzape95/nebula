import { CardSkeleton, Skeleton, StatRowSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="border-b border-edge px-5 pt-40 pb-20 sm:px-8">
        <div className="mx-auto max-w-app">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-6 h-14 w-full max-w-2xl" />
        </div>
      </div>
      <section className="mx-auto max-w-app px-5 py-16 sm:px-8">
        <Skeleton className="h-16 w-full" />
        <div className="mt-12">
          <StatRowSkeleton />
        </div>
        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <CardSkeleton height="h-56" />
          <CardSkeleton height="h-56" />
        </div>
      </section>
    </>
  );
}
