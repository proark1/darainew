import { Skeleton } from '@/components/ui/skeleton';

export function TaskCardSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border">
      <Skeleton className="h-5 w-5 rounded-md flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  );
}

export function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}
