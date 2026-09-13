'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Drive } from '@prisma/client';
import { DriveCard } from './drive-card';
import Pagination from '@/components/ui/pagination';

interface DrivesGridProps {
  drives: Drive[];
  appliedDriveIds: Set<string>;
  departmentMap: Record<string, string>;
  page: number;
  pageSize: number;
  totalCount: number;
  applicantCounts?: Record<string, number>; // driveId -> count
}

/**
 * Drives grid with pagination
 * Client component that renders drive cards in a grid and handles pagination
 */
export function DrivesGrid({
  drives,
  appliedDriveIds,
  departmentMap,
  page,
  pageSize,
  totalCount,
  applicantCounts = {},
}: DrivesGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleApplyClick(driveId: string) {
    // Navigate to drive detail page
    router.push(`${pathname}/${driveId}`);
  }

  // Empty state
  if (drives.length === 0) {
    const filter = searchParams.get('filter') || 'all';
    const search = searchParams.get('q');
    
    let emptyMessage = 'No eligible drives found.';
    if (search) {
      emptyMessage = `No drives match "${search}".`;
    } else if (filter === 'open') {
      emptyMessage = 'No open drives available right now.';
    } else if (filter === 'applied') {
      emptyMessage = 'You haven\'t applied to any drives yet.';
    } else if (filter === 'upcoming') {
      emptyMessage = 'No upcoming drives at the moment.';
    } else if (filter === 'closed') {
      emptyMessage = 'No closed drives to show.';
    }

    return (
      <div
        className="drives-empty"
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗂</div>
        <p style={{ fontSize: 15, margin: 0 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="drives-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {drives.map((drive) => (
          <DriveCard
            key={drive.id}
            drive={drive}
            isApplied={appliedDriveIds.has(drive.id)}
            applicantCount={applicantCounts[drive.id] || 0}
            departmentMap={departmentMap}
            onApplyClick={handleApplyClick}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalCount > pageSize && (
        <div
          style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </>
  );
}
