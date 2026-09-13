'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { DepartmentStudentsResult } from '@/features/students/queries/get-department-students';
import { StudentDetailsDialog } from './student-details-dialog';
import Pagination from '@/components/ui/pagination';
import { exportToCsv } from '@/lib/csv-export';

interface StudentRosterClientProps {
  initialData: DepartmentStudentsResult;
  departmentCode: string;
}

/**
 * Student Roster Client Component
 * 
 * Handles search, status filter, table display, pagination, CSV export, and detail dialog.
 * Search and filter changes update URL params which triggers server re-fetch.
 */
export function StudentRosterClient({
  initialData,
  departmentCode,
}: StudentRosterClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  const currentStatus = (searchParams.get('status') as 'all' | 'placed' | 'unplaced' | 'pending') || 'all';

  // Handle search with debounce
  function handleSearchChange(value: string) {
    setSearchInput(value);
    
    // Simple debounce: update URL after user stops typing for 300ms
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      params.delete('page'); // Reset to page 1
      router.push(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }

  function handleStatusFilter(status: 'all' | 'placed' | 'unplaced' | 'pending') {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.delete('page'); // Reset to page 1
    router.push(`${pathname}?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleExportCsv() {
    const csvData = initialData.data.map((s) => ({
      'Roll Number': s.rollNumber,
      'Full Name': s.name,
      'Department': s.department.code,
      'CGPA': s.academic?.currentCGPA ?? '—',
      'Backlogs': s.academic?.activeBacklogs ?? 0,
      'Status': s.isPending
        ? 'Pending Registration'
        : s.placementStatus === 'placed'
        ? 'Placed'
        : s.placementStatus === 'unplaced'
        ? 'Eligible'
        : 'Opted Out',
      'Email': s.email,
      'Phone': s.phoneNumber ?? '—',
    }));

    exportToCsv(`${departmentCode}_students_roster`, csvData);
  }

  // Status badge helper
  function getStatusBadge(student: typeof initialData.data[0]) {
    if (student.isPending) {
      return { text: 'Pending Registration', className: 'badge-amber' };
    }
    if (student.placementStatus === 'placed') {
      return { text: 'Placed', className: 'badge-green' };
    }
    if (student.placementStatus === 'unplaced') {
      return { text: 'Eligible', className: 'badge-purple' };
    }
    return { text: 'Opted Out', className: 'badge-gray' };
  }

  return (
    <>
      {/* Search and filter bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <input
          placeholder={`Search ${departmentCode} students by name or roll number…`}
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            maxWidth: 360,
            flex: 1,
            padding: '9px 12px',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 8,
            fontSize: 13,
          }}
        />

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Status:</span>
          {[
            { value: 'all', label: 'All' },
            { value: 'placed', label: 'Placed' },
            { value: 'unplaced', label: 'Eligible' },
            { value: 'pending', label: 'Pending' },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`btn btn-sm ${
                currentStatus === filter.value ? 'btn-primary' : 'btn-outline'
              }`}
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => handleStatusFilter(filter.value as any)}
            >
              {filter.label}
            </button>
          ))}
          
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleExportCsv}
            style={{ fontSize: 11, padding: '4px 10px', marginLeft: 4 }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Students table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Roll Number</th>
              <th>Department</th>
              <th>CGPA</th>
              <th>Backlogs</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {initialData.data.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: 32,
                    color: 'var(--text-secondary)',
                  }}
                >
                  No students found for {departmentCode} matching current criteria.
                </td>
              </tr>
            ) : (
              initialData.data.map((student) => {
                const statusBadge = getStatusBadge(student);
                const hasBacklogs = (student.academic?.activeBacklogs ?? 0) > 0;

                return (
                  <tr
                    key={student.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStudentId(student.id)}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{student.name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {student.email}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                        }}
                      >
                        {student.rollNumber}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--accent)',
                        }}
                      >
                        {student.department.code}
                      </span>
                    </td>
                    <td>
                      <strong>{student.academic?.currentCGPA ?? '—'}</strong>{' '}
                      {student.academic?.currentCGPA && (
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          / 10
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          color: hasBacklogs
                            ? 'var(--red, #ef4444)'
                            : 'inherit',
                          fontWeight: hasBacklogs ? 700 : 400,
                        }}
                      >
                        {student.academic?.activeBacklogs ?? 0}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge.className}`}>
                        {statusBadge.text}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentId(student.id);
                        }}
                      >
                        View Details ↗
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {initialData.totalCount > initialData.pageSize && (
        <div
          style={{
            marginTop: 24,
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <Pagination
            page={initialData.page}
            pageSize={initialData.pageSize}
            totalCount={initialData.totalCount}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Student Details Dialog */}
      <StudentDetailsDialog
        studentId={selectedStudentId}
        onClose={() => setSelectedStudentId(null)}
      />
    </>
  );
}
