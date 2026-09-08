'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  function getPageNumbers(): (number | string)[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [1];

    if (page <= 3) {
      pages.push(2, 3, 4, '...', totalPages);
    } else if (page >= totalPages - 2) {
      pages.push('...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push('...', page - 1, page, page + 1, '...', totalPages);
    }

    return pages;
  }

  const pageNumbers = getPageNumbers();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: '0.5px solid var(--border)',
        fontSize: '13px',
      }}
    >
      <div style={{ color: 'var(--text-secondary)' }}>
        Showing {startItem}–{endItem} of {totalCount}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              Rows:
            </span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                border: '0.5px solid var(--border-strong)',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
                background: 'var(--surface-2)',
                cursor: 'pointer',
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            style={{
              padding: '6px',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-2)',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          {pageNumbers.map((num, idx) => {
            if (num === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '6px 12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  ...
                </span>
              );
            }

            const pageNum = num as number;
            const isActive = pageNum === page;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                style={{
                  padding: '6px 12px',
                  border: '0.5px solid var(--border-strong)',
                  borderRadius: 'var(--radius)',
                  background: isActive ? 'var(--accent)' : 'var(--surface-2)',
                  color: isActive ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                }}
                aria-label={`Page ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages || totalCount === 0}
            style={{
              padding: '6px',
              border: '0.5px solid var(--border-strong)',
              borderRadius: 'var(--radius)',
              background: 'var(--surface-2)',
              cursor:
                page === totalPages || totalCount === 0
                  ? 'not-allowed'
                  : 'pointer',
              opacity: page === totalPages || totalCount === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
