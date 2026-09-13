'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface DrivesFilterBarProps {
  appliedCount?: number;
  upcomingCount?: number;
  closedCount?: number;
}

const FILTERS = [
  { value: 'all', label: 'All drives' },
  { value: 'open', label: 'Open' },
  { value: 'applied', label: 'Applied' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'closed', label: 'Closed' },
] as const;

/**
 * Filter pills for drives catalogue
 * Updates URL search params on filter change
 */
export function DrivesFilterBar({ appliedCount, upcomingCount, closedCount }: DrivesFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const currentFilter = searchParams.get('filter') || 'all';
  
  function handleFilterChange(filterValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    
    if (filterValue === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filterValue);
    }
    
    // Reset to page 1 on filter change
    params.delete('page');
    
    router.push(`${pathname}?${params.toString()}`);
  }
  
  return (
    <div className="drives-filters" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {FILTERS.map((filter) => {
        const isActive = currentFilter === filter.value;
        
        // Show count badges for specific filters
        let countBadge = null;
        if (filter.value === 'applied' && appliedCount !== undefined && appliedCount > 0) {
          countBadge = <span style={{ 
            marginLeft: 4, 
            fontSize: 10, 
            opacity: 0.8,
            fontWeight: 600 
          }}>({appliedCount})</span>;
        } else if (filter.value === 'upcoming' && upcomingCount !== undefined && upcomingCount > 0) {
          countBadge = <span style={{ 
            marginLeft: 4, 
            fontSize: 10, 
            opacity: 0.8,
            fontWeight: 600 
          }}>({upcomingCount})</span>;
        } else if (filter.value === 'closed' && closedCount !== undefined && closedCount > 0) {
          countBadge = <span style={{ 
            marginLeft: 4, 
            fontSize: 10, 
            opacity: 0.8,
            fontWeight: 600 
          }}>({closedCount})</span>;
        }
        
        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => handleFilterChange(filter.value)}
            className={`filter-pill ${isActive ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: isActive ? 'var(--accent-surface)' : 'var(--surface-0)',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {filter.label}
            {countBadge}
          </button>
        );
      })}
    </div>
  );
}
