import { CardSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <PageHeaderSkeleton />
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        <div className="space-y-8">
          <CardSkeleton height="h-24" />
          <CardSkeleton height="h-44" />
        </div>
        <CardSkeleton height="h-72" />
      </div>
    </div>
  );
}
