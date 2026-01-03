import { Skeleton } from '@/components/ui/skeleton';

export function CalendarEventSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
      <div className="w-1 h-10 rounded-full bg-muted" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function CalendarDaySkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <CalendarEventSkeleton />
      <CalendarEventSkeleton />
    </div>
  );
}

export function CalendarWeekSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <CalendarDaySkeleton key={i} />
      ))}
    </div>
  );
}
