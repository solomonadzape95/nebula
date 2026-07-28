import { CardSkeleton, PageHeaderSkeleton, StatRowSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <PageHeaderSkeleton />
      <div className="mt-12">
        <StatRowSkeleton count={2} />
      </div>
      <div className="mt-16 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <CardSkeleton height="h-32" />
        <CardSkeleton height="h-32" />
      </div>
    </div>
  );
}
