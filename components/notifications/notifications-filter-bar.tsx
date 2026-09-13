'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const FILTERS = ['All', 'Unread', 'Drives', 'System'] as const;
type FilterTab = typeof FILTERS[number];

interface NotificationsFilterBarProps {
  currentFilter: string;
}

/**
 * Filter pills for notifications page
 * Updates URL search params on filter change
 */
export function NotificationsFilterBar({ currentFilter }: NotificationsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleFilter(f: FilterTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('filter', f.toLowerCase());
    params.delete('page'); // Reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {FILTERS.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`filter-pill ${currentFilter === tab.toLowerCase() ? 'active' : ''}`}
          onClick={() => handleFilter(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
