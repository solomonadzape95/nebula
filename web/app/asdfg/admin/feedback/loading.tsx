import { CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-app px-5 py-10 sm:px-8 sm:py-14">
      <PageHeaderSkeleton />
      <div className="mt-10">
        <CardSkeleton height="h-24" />
      </div>
      <div className="mt-10">
        <TableSkeleton rows={3} />
      </div>
    </div>
  );
}
