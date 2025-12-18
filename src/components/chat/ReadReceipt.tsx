import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ReadReceiptProps {
  sent: boolean;
  read: boolean;
  readAt?: string | null;
  isOwn: boolean;
}

export function ReadReceipt({ sent, read, readAt, isOwn }: ReadReceiptProps) {
  if (!isOwn) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex ml-1">
            {read ? (
              <CheckCheck className={cn(
                'w-3.5 h-3.5',
                'text-blue-400'
              )} />
            ) : sent ? (
              <Check className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <span className="w-3.5 h-3.5" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {read && readAt ? (
            <span>Read at {format(new Date(readAt), 'MMM d, HH:mm')}</span>
          ) : sent ? (
            <span>Delivered</span>
          ) : (
            <span>Sending...</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
