import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireStudent, AuthorizationError } from '@/lib/auth';
import { getDriveDetail } from '@/features/drives/queries/get-drive-detail';
import { getIneligibilityReasons } from '@/features/drives/queries/drive-eligibility';
import { getDriveStatus } from '@/features/drives/utils/drive-status';
import { checkApplicationExists } from '@/features/applications/queries/check-application-exists';
import { formatDriveDate, formatDeadline } from '@/lib/drive-date-helpers';
import { ApplySection } from '@/components/drives/apply-section';
import { prisma } from '@/lib/prisma';
import StatusBadge from '@/components/ui/status-badge';

interface DriveDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Drive Detail Page
 * 
 * Shows complete drive information with eligibility checklist
 * Server-side eligibility check - redirects if student is not eligible
 */
export default async function DriveDetailPage({ params }: DriveDetailPageProps) {
  const { user, student } = await requireStudent();
  const { id } = await params;

  // Get student with academic info
  const studentWithAcademic = await prisma.student.findUnique({
    where: { id: student.id },
    include: {
      academic: true,
      department: { select: { id: true, name: true, code: true } },
    },
  });

  if (!studentWithAcademic || !studentWithAcademic.academic) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          Academic Profile Incomplete
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Please complete your academic information to view drives.
        </p>
        <Link
          href="/student-dashboard/profile"
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
          Complete Profile
        </Link>
      </div>
    );
  }

  // Get drive detail (with server-side eligibility check)
  let drive;
  try {
    drive = await getDriveDetail(id);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // Not eligible - show ineligible page
      return (
        <div style={{ padding: '60px 32px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 8,
              color: 'var(--text-primary)',
            }}
          >
            Not Eligible
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
            You are not eligible for this drive or it does not exist.
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
            ← Back to Drives
          </Link>
        </div>
      );
    }
    notFound();
  }

  // Get drive status
  const driveStatus = getDriveStatus(drive.applicationDeadline);

  // Check if already applied
  const hasApplied = await checkApplicationExists(student.id, drive.id);

  // Get ineligibility reasons (for checklist display)
  const ineligibilityReasons = getIneligibilityReasons(studentWithAcademic, drive);
  const isFullyEligible = ineligibilityReasons.length === 0;

  // Eligible departments, from the DriveEligibleDepartment relation
  const eligibleDeptIds = drive.eligibleDepartmentLinks.map((link) => link.departmentId);
  const eligibleDepts = await prisma.department.findMany({
    where: { id: { in: eligibleDeptIds } },
    select: { name: true },
  });
  const eligibleDeptNames = eligibleDepts.map((d) => d.name);

  // Check each eligibility criterion
  const cgpaCheck = studentWithAcademic.academic.currentCGPA >= drive.minCGPA;
  const backlogsCheck = studentWithAcademic.academic.activeBacklogs <= drive.maxActiveBacklogs;
  const deptCheck = eligibleDeptIds.includes(studentWithAcademic.departmentId);
  const deadlineCheck = driveStatus === 'open';

  // Package display
  const packageText = drive.packageDisplay || `${drive.packageOffered} LPA`;

  // Get applicant count
  const applicantCount = await prisma.driveApplication.count({
    where: { driveId: drive.id },
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Back link */}
      <Link
        href="/student-dashboard/drives"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        ← Back to Drives
      </Link>

      {/* Drive Header */}
      <div
        style={{
          padding: 24,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-0)',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: 'var(--accent-surface)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {drive.companyName.slice(0, 4).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                marginBottom: 4,
              }}
            >
              {drive.roleName}
            </h1>
            <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {drive.companyName}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge variant="accent">{packageText}</StatusBadge>
              {driveStatus === 'open' ? (
                <StatusBadge variant="green">Open</StatusBadge>
              ) : (
                <StatusBadge variant="red">Closed</StatusBadge>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {applicantCount} applicant{applicantCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            padding: 16,
            borderRadius: 8,
            background: 'var(--surface-1)',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Drive Date
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {formatDriveDate(drive.driveDate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Application Deadline
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {formatDeadline(drive.applicationDeadline)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Min CGPA
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{drive.minCGPA}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Max Backlogs
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{drive.maxActiveBacklogs}</div>
          </div>
        </div>
      </div>

      {/* Eligibility Checklist */}
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-0)',
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 16,
            margin: 0,
          }}
        >
          Eligibility Checklist
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* CGPA Check */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, color: cgpaCheck ? 'var(--teal)' : 'var(--red)' }}>
              {cgpaCheck ? '✓' : '✗'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                CGPA: {studentWithAcademic.academic.currentCGPA} {cgpaCheck ? '≥' : '<'}{' '}
                {drive.minCGPA} (required)
              </div>
            </div>
          </div>

          {/* Backlogs Check */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, color: backlogsCheck ? 'var(--teal)' : 'var(--red)' }}>
              {backlogsCheck ? '✓' : '✗'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                Active backlogs: {studentWithAcademic.academic.activeBacklogs}{' '}
                {backlogsCheck ? '≤' : '>'} {drive.maxActiveBacklogs} (allowed)
              </div>
            </div>
          </div>

          {/* Department Check */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, color: deptCheck ? 'var(--teal)' : 'var(--red)' }}>
              {deptCheck ? '✓' : '✗'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                Department: {studentWithAcademic.department.name} (
                {deptCheck ? 'eligible' : 'not eligible'})
              </div>
              {eligibleDeptNames.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Eligible: {eligibleDeptNames.join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Deadline Check */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, color: deadlineCheck ? 'var(--teal)' : 'var(--red)' }}>
              {deadlineCheck ? '✓' : '✗'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                Drive {deadlineCheck ? 'open' : 'closed'}: Deadline{' '}
                {formatDeadline(drive.applicationDeadline)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Job Description */}
      {drive.jobDescriptionUrl && (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-0)',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 12,
              margin: 0,
            }}
          >
            Job Description
          </h2>
          <a
            href={drive.jobDescriptionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-1)',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            📄 View JD (PDF) ↗
          </a>
        </div>
      )}

      {/* Selection Process */}
      {drive.selectionRounds && (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-0)',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 12,
              margin: 0,
            }}
          >
            Selection Process
          </h2>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {drive.selectionRounds}
          </div>
        </div>
      )}

      {/* Logistics */}
      {(drive.venue || drive.reportingTime || drive.contactPerson || drive.pptLink) && (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-0)',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 12,
              margin: 0,
            }}
          >
            Venue & Logistics
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
            {drive.venue && (
              <div>
                <strong>Venue:</strong> {drive.venue}
              </div>
            )}
            {drive.reportingTime && (
              <div>
                <strong>Reporting Time:</strong> {drive.reportingTime}
              </div>
            )}
            {drive.contactPerson && (
              <div>
                <strong>Contact Person:</strong> {drive.contactPerson}
                {drive.contactPhone && ` (${drive.contactPhone})`}
              </div>
            )}
            {drive.pptLink && (
              <div style={{ marginTop: 8 }}>
                <a
                  href={drive.pptLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--teal)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  🎥 Pre-Placement Talk Link ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apply Section */}
      <ApplySection
        driveId={drive.id}
        companyName={drive.companyName}
        roleName={drive.roleName}
        driveDate={drive.driveDate}
        applicationDeadline={drive.applicationDeadline}
        driveStatus={driveStatus}
        hasApplied={hasApplied}
        applyMethod={drive.applyMethod}
        externalApplyUrl={drive.externalApplyUrl}
        studentName={studentWithAcademic.name}
        studentCGPA={studentWithAcademic.academic.currentCGPA}
        studentBacklogs={studentWithAcademic.academic.activeBacklogs}
        studentDepartment={studentWithAcademic.department.name}
        studentRollNumber={studentWithAcademic.rollNumber ?? ''}
      />
    </div>
  );
}
