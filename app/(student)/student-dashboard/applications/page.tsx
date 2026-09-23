import { requireStudent } from '@/lib/auth';
import { getMyApplications } from '@/features/applications/queries/get-my-applications';
import { getDriveStatus } from '@/features/drives/utils/drive-status';
import { formatNextStageDate } from '@/lib/drive-date-helpers';
import StatusBadge from '@/components/ui/status-badge';
import Pagination from '@/components/ui/pagination';
import Link from 'next/link';

import { formatPackage } from '@/features/drives/utils/format-package';
interface ApplicationsPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

/**
 * My Applications Page
 * 
 * Shows all applications submitted by the student
 */
export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const { user, student } = await requireStudent();

  // Parse page from search params
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;

  // Get applications
  const applicationsResult = await getMyApplications(student.id, page, pageSize);

  // Empty state
  if (applicationsResult.totalCount === 0) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 4,
            }}
          >
            My Applications
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            Track all your submitted applications
          </p>
        </div>

        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-0)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗂</div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            No applications yet
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Browse eligible drives and apply to get started.
          </p>
          <Link
            href="/student-dashboard/drives"
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'white',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Browse Drives →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 4,
            }}
          >
            My Applications
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {applicationsResult.totalCount} application{applicationsResult.totalCount !== 1 ? 's' : ''} submitted
          </p>
        </div>
        <Link
          href="/student-dashboard/drives"
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface-0)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          Browse Drives →
        </Link>
      </div>

      {/* Applications Table */}
      <div
        className="table-wrap"
        style={{
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-0)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--surface-1)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Company
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Role
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Package
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Applied On
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Next Stage Date
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {applicationsResult.data.map((application) => {
                const driveStatus = getDriveStatus(application.drive);
                const packageText = formatPackage(application.drive);
                const appliedDate = new Date(application.appliedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <tr
                    key={application.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {application.drive.companyName}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: 14,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {application.drive.roleName}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: 14,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {packageText}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {appliedDate}
                      {application.snapshotCgpa && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                            marginTop: 2,
                          }}
                          title={`Applied with CGPA ${application.snapshotCgpa}, ${application.snapshotBacklogs} backlogs`}
                        >
                          CGPA: {application.snapshotCgpa}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {formatNextStageDate(application.drive.nextStageDate)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {application.driveCancelled ? (
                        <StatusBadge variant="red">Cancelled</StatusBadge>
                      ) : driveStatus === 'open' ? (
                        <StatusBadge variant="green">Open</StatusBadge>
                      ) : (
                        <StatusBadge variant="red">Closed</StatusBadge>
                      )}
                      {/* Recruitment progress — set by the department, read-only here. */}
                      {application.stageLabel && (
                        <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>
                          Stage: <strong>{application.stageLabel}</strong>
                          {application.status === 'SELECTED' && ' · Selected'}
                          {application.status === 'REJECTED' && ' · Not selected'}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        textAlign: 'right',
                      }}
                    >
                      <Link
                        href={`/student-dashboard/drives/${application.drive.id}`}
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--accent)',
                          textDecoration: 'none',
                        }}
                      >
                        View drive →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {applicationsResult.totalCount > pageSize && (
          <Pagination
            page={applicationsResult.page}
            pageSize={applicationsResult.pageSize}
            totalCount={applicationsResult.totalCount}
            onPageChange={(newPage) => {
              // This will be handled by the client-side navigation
              // We need a client component wrapper for this
            }}
          />
        )}
      </div>

      {/* Summary Card */}
      <div
        style={{
          marginTop: 24,
          padding: 20,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-0)',
        }}
      >
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 12,
            margin: 0,
          }}
        >
          Application Summary
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Total Applications
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {applicationsResult.totalCount}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Active Drives
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>
              {applicationsResult.data.filter((a) => getDriveStatus(a.drive) === 'open').length}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Closed Drives
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)' }}>
              {applicationsResult.data.filter((a) => getDriveStatus(a.drive) === 'closed').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
