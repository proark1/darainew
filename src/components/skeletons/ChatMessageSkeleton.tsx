import { Skeleton } from '@/components/ui/skeleton';

interface ChatMessageSkeletonProps {
  isOwn?: boolean;
}

export function ChatMessageSkeleton({ isOwn = false }: ChatMessageSkeletonProps) {
  return (
    <div className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
      <div className={`space-y-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        <Skeleton 
          className={`h-10 rounded-2xl ${isOwn ? 'w-32' : 'w-48'}`} 
        />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function ChatListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} isOwn={i % 3 === 0} />
      ))}
    </div>
  );
}
