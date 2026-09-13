'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { markAllNotificationsRead } from '@/features/notifications/actions/mark-all-notifications-read';

interface MarkAllReadButtonProps {
  hasUnread: boolean;
}

/**
 * Mark all notifications as read button
 * Only renders if there are unread notifications
 */
export function MarkAllReadButton({ hasUnread }: MarkAllReadButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  if (!hasUnread) return null;

  function handleMarkAll() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.success) {
        toast({ 
          title: 'Done', 
          description: 'All notifications marked as read.' 
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not mark notifications as read.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={handleMarkAll}
      disabled={isPending}
    >
      {isPending ? 'Marking…' : 'Mark all as read'}
    </button>
  );
}
