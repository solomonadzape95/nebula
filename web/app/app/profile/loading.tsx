import { CardSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <PageHeaderSkeleton />
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <CardSkeleton height="h-80" />
        <CardSkeleton height="h-56" />
      </div>
    </div>
  );
}
