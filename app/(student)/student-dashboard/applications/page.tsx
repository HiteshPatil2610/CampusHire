import { requireStudent } from '@/lib/auth';
import { getMyApplications } from '@/features/applications/queries/get-my-applications';
import { getDriveStatus } from '@/features/drives/utils/drive-status';
import { formatNextStageDate } from '@/lib/drive-date-helpers';
import StatusBadge from '@/components/ui/status-badge';
import Pagination from '@/components/ui/pagination';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

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

  const activeCount = applicationsResult.data.filter((a) => getDriveStatus(a.drive) === 'open').length;
  const closedCount = applicationsResult.data.filter((a) => getDriveStatus(a.drive) === 'closed').length;

  const thStyle: React.CSSProperties = {
    padding: '14px 20px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  };
  const tdStyle: React.CSSProperties = {
    padding: 20,
    fontSize: 14,
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
  };
  const subTextStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-secondary)',
    marginTop: 4,
  };

  const summaryStats = [
    { label: 'Total Applications', value: applicationsResult.totalCount },
    { label: 'Active Drives', value: activeCount },
    { label: 'Closed Drives', value: closedCount },
  ];

  return (
    <div>
      {/* My Applications */}
      <section style={{ padding: '48px 32px 44px', maxWidth: 1080, margin: '0 auto' }}>
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'white',
              textDecoration: 'none',
            }}
          >
            Browse Drives <ChevronRight size={14} />
          </Link>
        </div>

        {/* Applications Table */}
        <div
          className="table-wrap"
          style={{
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-0)', borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Role &amp; Package</th>
                  <th style={thStyle}>Submission</th>
                  <th style={thStyle}>Next Milestone</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {applicationsResult.data.map((application, index) => {
                  const driveStatus = getDriveStatus(application.drive);
                  const appliedDate = new Date(application.appliedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr
                      key={application.id}
                      style={{
                        borderBottom:
                          index < applicationsResult.data.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <td style={{ ...tdStyle, fontSize: 15, fontWeight: 500 }}>
                        {application.drive.companyName}
                      </td>
                      <td style={tdStyle}>
                        {application.drive.roleName}
                        <div style={subTextStyle}>{formatPackage(application.drive)}</div>
                      </td>
                      <td style={tdStyle}>
                        {appliedDate}
                        {application.snapshotCgpa && (
                          <div
                            style={subTextStyle}
                            title={`Applied with CGPA ${application.snapshotCgpa}, ${application.snapshotBacklogs} backlogs`}
                          >
                            CGPA: {application.snapshotCgpa}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>{formatNextStageDate(application.drive.nextStageDate)}</td>
                      <td style={tdStyle}>
                        {application.driveCancelled ? (
                          <StatusBadge variant="red">CANCELLED</StatusBadge>
                        ) : driveStatus === 'open' ? (
                          <StatusBadge variant="green">OPEN</StatusBadge>
                        ) : (
                          <StatusBadge variant="red">CLOSED</StatusBadge>
                        )}
                        {/* Recruitment progress — set by the department, read-only here. */}
                        {application.stageLabel && (
                          <div style={subTextStyle}>
                            Stage: {application.stageLabel}
                            {application.status === 'SELECTED' && ' · Selected'}
                            {application.status === 'REJECTED' && ' · Not selected'}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <Link
                          href={`/student-dashboard/drives/${application.drive.id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 14,
                            color: 'var(--accent)',
                            textDecoration: 'none',
                          }}
                        >
                          View drive <ChevronRight size={14} />
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
      </section>

      {/* Application Summary */}
      <section style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '40px 32px 32px', maxWidth: 1080, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 20px',
            }}
          >
            Application Summary
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 20,
            }}
          >
            {summaryStats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: 20,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-0)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  {stat.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
