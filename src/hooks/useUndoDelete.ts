import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

interface DeletedItem<T> {
  item: T;
  type: 'task' | 'event';
  restoreCallback: (item: T) => Promise<void>;
}

const UNDO_TIMEOUT = 5000; // 5 seconds

export function useUndoDelete<T extends { id: string; title: string }>() {
  const [pendingDelete, setPendingDelete] = useState<DeletedItem<T> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performDelete = useCallback(async (
    item: T,
    type: 'task' | 'event',
    deleteCallback: () => Promise<void>,
    restoreCallback: (item: T) => Promise<void>
  ) => {
    // Clear any pending delete
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Store the item for potential undo
    setPendingDelete({ item, type, restoreCallback });

    // Perform the actual delete
    await deleteCallback();

    // Show undo toast
    const { dismiss } = toast({
      title: `${type === 'task' ? 'Task' : 'Event'} deleted`,
      description: `"${item.title}" - Click Undo to restore`,
      duration: UNDO_TIMEOUT,
    });

    // Auto-dismiss after timeout
    timeoutRef.current = setTimeout(() => {
      setPendingDelete(null);
    }, UNDO_TIMEOUT);

    return {
      undo: async () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        await restoreCallback(item);
        setPendingDelete(null);
        dismiss();
        toast({
          title: 'Restored',
          description: `"${item.title}" has been restored`,
        });
      },
      dismiss,
    };
  }, []);

  const cancelPendingDelete = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setPendingDelete(null);
  }, []);

  return {
    pendingDelete,
    performDelete,
    cancelPendingDelete,
  };
}
