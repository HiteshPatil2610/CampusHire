'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Pagination from '@/components/ui/pagination';

export interface ApplicationsPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
}

export default function ApplicationsPagination({
  page,
  pageSize,
  totalCount,
}: ApplicationsPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handlePageChange(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div style={{ marginTop: 24 }}>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
