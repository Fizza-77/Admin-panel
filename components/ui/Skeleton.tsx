import { cn } from '@/lib/ui/cn';
import Spinner from '@/components/ui/Spinner';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('ui-shimmer', className)} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="ui-surface p-6 space-y-4" aria-hidden>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </div>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div aria-label="Loading tasks" aria-busy>
      <div className="mb-6 flex justify-center">
        <Spinner size="md" label="Loading tasks" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="ui-kanban-column p-3 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
