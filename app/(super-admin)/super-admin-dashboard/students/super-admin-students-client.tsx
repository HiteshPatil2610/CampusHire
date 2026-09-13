"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import Pagination from "@/components/ui/pagination";
import { exportToCsv } from "@/lib/csv-export";
import type { Student, Department, StudentAcademic } from "@prisma/client";

interface StudentWithRelations extends Student {
  department: Department;
  academic: StudentAcademic | null;
}

interface Props {
  students: StudentWithRelations[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  departments: Department[];
  filters: {
    deptId: string;
    status: string;
    search: string;
  };
}

const YEAR_SUFFIXES = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

function formatYear(currentSemester: number | undefined): string {
  if (!currentSemester) return '—';
  const year = Math.ceil(currentSemester / 2);
  return YEAR_SUFFIXES[year - 1] || `${year}th`;
}

export function SuperAdminStudentsClient({
  students,
  currentPage,
  totalPages,
  totalCount,
  departments,
  filters,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);

  function updateFilter(key: string, value: string) {
    const url = new URL(window.location.href);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    if (key !== 'page') {
      url.searchParams.delete('page'); // Reset to page 1 when filters change
    }
    router.push(url.pathname + url.search);
  }

  function handleSearch() {
    updateFilter('search', search);
  }

  function handleExportCsv() {
    const rows = students.map((student) => ({
      'Roll Number': student.rollNumber,
      'Name': student.name,
      'Department': student.department.code,
      'Year': formatYear(student.academic?.currentSemester),
      'Email': student.email,
      'Phone': student.phoneNumber || '',
      'CGPA': student.academic?.currentCGPA?.toString() || '',
      'Backlogs': student.academic?.activeBacklogs?.toString() || '0',
      'Status': student.isPending ? 'Pending' : student.placementStatus === 'PLACED' ? 'Placed' : 'Eligible',
    }));

    const deptFilter = filters.deptId
      ? departments.find(d => d.id === filters.deptId)?.code || 'filtered'
      : 'all';
    exportToCsv(`campushire_students_${deptFilter}`, rows);
  }

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Department Filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={!filters.deptId ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            onClick={() => updateFilter('deptId', '')}
          >
            All Depts
          </button>
          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              className={filters.deptId === dept.id ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => updateFilter('deptId', dept.id)}
            >
              {dept.code}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
          <span className="text-muted" style={{ fontSize: 12 }}>Status:</span>
          {[
            { value: 'all', label: 'All' },
            { value: 'placed', label: 'Placed' },
            { value: 'eligible', label: 'Eligible' },
            { value: 'attention', label: 'Needs Attention' },
            { value: 'pending', label: 'Pending' },
          ].map((st) => (
            <button
              key={st.value}
              type="button"
              className={filters.status === st.value ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => updateFilter('status', st.value)}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Export */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          className="input"
          placeholder="Search by name, roll number, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ maxWidth: 400 }}
        />
        <button type="button" className="btn btn-outline" onClick={handleSearch}>
          Search
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleExportCsv}
          style={{ marginLeft: 'auto' }}
        >
          📥 Export CSV ({totalCount})
        </button>
      </div>

      {/* Students Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Roll Number</th>
              <th>Department</th>
              <th>Year</th>
              <th>CGPA</th>
              <th>Backlogs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="text-muted">No students found</div>
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {student.email}
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: 12 }}>{student.rollNumber}</code>
                  </td>
                  <td>{student.department.code}</td>
                  <td>{formatYear(student.academic?.currentSemester)}</td>
                  <td>{student.academic?.currentCGPA?.toFixed(2) || '—'}</td>
                  <td>
                    {student.academic?.activeBacklogs !== undefined ? (
                      student.academic.activeBacklogs > 0 ? (
                        <span style={{ color: 'var(--red)' }}>
                          {student.academic.activeBacklogs}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--teal)' }}>0</span>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {student.isPending ? (
                      <StatusBadge variant="amber">Pending</StatusBadge>
                    ) : student.placementStatus === 'PLACED' ? (
                      <StatusBadge variant="teal">Placed</StatusBadge>
                    ) : (
                      <StatusBadge variant="purple">Eligible</StatusBadge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: 20 }}>
          <Pagination
            page={currentPage}
            pageSize={50}
            totalCount={totalCount}
            onPageChange={(page) => updateFilter('page', page.toString())}
          />
        </div>
      )}
    </>
  );
}
