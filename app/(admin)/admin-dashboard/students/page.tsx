import Link from 'next/link';
import { requireDepartmentAdmin } from '@/lib/auth';
import { getDepartmentStudents } from '@/features/students/queries/get-department-students';
import { DepartmentScopeBanner } from '@/components/shared/department-scope-banner';
import { StudentRosterClient } from '@/components/admin/students/student-roster-client';

export const dynamic = 'force-dynamic';

interface AdminStudentsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

/**
 * Admin Student Roster Page
 * 
 * Searchable, filterable, paginated table of students in the admin's department.
 * All queries are department-scoped via requireDepartmentAdmin().
 */
export default async function AdminStudentsPage({
  searchParams,
}: AdminStudentsPageProps) {
  // Auth: department admin only
  const { department } = await requireDepartmentAdmin();

  // Parse search params
  const params = await searchParams;
  const search = params.search;
  const status = (params.status as 'all' | 'placed' | 'unplaced' | 'pending') || 'all';
  const page = params.page ? parseInt(params.page, 10) : 1;

  // Fetch students
  const studentsResult = await getDepartmentStudents({
    search,
    status,
    page,
    pageSize: 25,
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>
      <DepartmentScopeBanner
        departmentName={department.name}
        departmentCode={department.code}
        studentCount={studentsResult.totalCount}
      />

      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {department.code} Department Students
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: '4px 0 0 0',
            }}
          >
            Showing verified student records enrolled in{' '}
            <strong>{department.code}</strong>.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin-dashboard/students/import">
            <button type="button" className="btn btn-outline">
              📥 Bulk Import
            </button>
          </Link>
          <Link href="/admin-dashboard/students/add">
            <button type="button" className="btn btn-primary">
              + Add Student
            </button>
          </Link>
        </div>
      </div>

      {/* Client component handles search, filter, table, pagination, CSV export, dialog */}
      <StudentRosterClient
        initialData={studentsResult}
        departmentCode={department.code}
      />
    </div>
  );
}
