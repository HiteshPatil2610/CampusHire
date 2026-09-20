'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CATEGORY_LABELS, NOTIFICATION_CATEGORIES } from '@/features/notifications/domain/events';

interface NotificationsFilterBarProps {
  currentFilter: string;
  /** Unread counts per category, for the badges. */
  counts: Record<string, number>;
  unreadCount: number;
}

/**
 * The notification centre's tabs: All, Unread, and one per category. The
 * filter lives in the URL, so a tab is shareable and the page is filtered in
 * the database rather than after paging.
 */
export function NotificationsFilterBar({
  currentFilter,
  counts,
  unreadCount,
}: NotificationsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs: { key: string; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: 0 },
    { key: 'unread', label: 'Unread', count: unreadCount },
    ...NOTIFICATION_CATEGORIES.map((category) => ({
      key: category,
      label: CATEGORY_LABELS[category],
      count: counts[category] ?? 0,
    })),
  ];

  function handleFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'all') params.delete('filter');
    else params.set('filter', key.toLowerCase());
    params.delete('page');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div
      role="tablist"
      aria-label="Notification categories"
      style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}
    >
      {tabs.map((tab) => {
        const active = currentFilter.toLowerCase() === tab.key.toLowerCase();
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`filter-pill ${active ? 'active' : ''}`}
            onClick={() => handleFilter(tab.key)}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ marginLeft: 6, fontWeight: 700 }}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
