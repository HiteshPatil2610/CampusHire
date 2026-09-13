"use client";

import { useRouter } from "next/navigation";
import StatusBadge from "@/components/ui/status-badge";
import Pagination from "@/components/ui/pagination";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import type { Drive, Department } from "@prisma/client";

interface DriveWithRelations extends Drive {
  department: Department;
  _count: {
    applications: number;
  };
}

interface Props {
  drives: DriveWithRelations[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  departments: Department[];
  filters: {
    deptId: string;
    status: string;
  };
}

export function SuperAdminDrivesClient({
  drives,
  currentPage,
  totalPages,
  totalCount,
  departments,
  filters,
}: Props) {
  const router = useRouter();

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
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
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

      {/* Drives Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Role</th>
              <th>Department</th>
              <th>Package</th>
              <th>Drive Date</th>
              <th>Deadline</th>
              <th>Applicants</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {drives.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="text-muted">No drives found</div>
                </td>
              </tr>
            ) : (
              drives.map((drive) => {
                const status = getDriveStatus(drive.applicationDeadline);
                return (
                  <tr key={drive.id}>
                    <td>
                      <strong>{drive.companyName}</strong>
                    </td>
                    <td>{drive.roleName}</td>
                    <td>{drive.department.code}</td>
                    <td>
                      {drive.packageDisplay || `${drive.packageOffered} LPA`}
                    </td>
                    <td>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {new Date(drive.driveDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {new Date(drive.applicationDeadline).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>
                        {drive._count.applications}
                      </span>
                    </td>
                    <td>
                      {status === 'open' ? (
                        <StatusBadge variant="teal">Open</StatusBadge>
                      ) : (
                        <StatusBadge variant="gray">Closed</StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: 20 }}>
          <Pagination
            page={currentPage}
            pageSize={20}
            totalCount={totalCount}
            onPageChange={(page) => updateFilter('page', page.toString())}
          />
        </div>
      )}

      {/* Total Count */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <span className="text-muted" style={{ fontSize: 12 }}>
          Showing {drives.length} of {totalCount} drives
        </span>
      </div>
    </>
  );
}
