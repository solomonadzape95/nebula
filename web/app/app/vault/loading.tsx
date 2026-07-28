import { CardSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <PageHeaderSkeleton />
      <Skeleton className="mt-10 h-4 w-full" />
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <CardSkeleton height="h-32" />
        <CardSkeleton height="h-32" />
      </div>
    </div>
  );
}
