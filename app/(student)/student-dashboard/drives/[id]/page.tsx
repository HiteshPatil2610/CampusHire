import { SEMESTER_MARKS_SELECT } from '@/features/drives/domain/eligibility-evaluator';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireStudent, AuthorizationError } from '@/lib/auth';
import { getDriveDetail } from '@/features/drives/queries/get-drive-detail';
import {
  evaluateStudentForDrive,
  getIneligibilityReasons,
} from '@/features/drives/queries/drive-eligibility';
import { getDriveStatus } from '@/features/drives/utils/drive-status';
import { checkApplicationExists } from '@/features/applications/queries/check-application-exists';
import { formatNextStageDate, formatDeadline } from '@/lib/drive-date-helpers';
import { ApplySection } from '@/components/drives/apply-section';
import { prisma } from '@/lib/prisma';
import { buildApplicationReviewData } from '@/features/applications/utils/application-review-fields';
import { ACTIVE_PLACEMENTS_SELECT } from '@/features/students/utils/placement-status';
import { serializePackageOffered } from '@/features/drives/utils/serialize-drive';
import StatusBadge from '@/components/ui/status-badge';
import { parseJsonArray } from '@/lib/parse-json-array';

import { formatPackage } from '@/features/drives/utils/format-package';
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
      // Eligibility reads skill names; the application form also reads skill
      // types, projects and certifications — all loaded in this one query.
      skills: { select: { skillName: true, skillType: true } },
      projects: { select: { title: true } },
      certifications: { select: { certificationName: true } },
      // Active placements — what the evaluator checks first.
      placements: ACTIVE_PLACEMENTS_SELECT,
      // Semesters with marks: the final-year marks gate reads them.
      semesterMarks: SEMESTER_MARKS_SELECT,
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

  // Get drive status (from this department's deadline — `drive` is resolved)
  const driveStatus = getDriveStatus(drive);
  const skills = parseJsonArray(drive.skills);
  // The department's pipeline stages students may see, else the legacy list.
  const selectionRounds = drive.recruitmentStages?.length
    ? drive.recruitmentStages.map((stage) => stage.name)
    : parseJsonArray(drive.selectionRounds);

  // Check if already applied
  const hasApplied = await checkApplicationExists(student.id, drive.id);

  // Get ineligibility reasons (for checklist display)
  // Standing (approved → placed → opted in → department) first, then this
  // drive's rules — the evaluator applyToDrive uses, in the same order.
  const ineligibilityReasons = getIneligibilityReasons(studentWithAcademic, drive);
  const isFullyEligible = ineligibilityReasons.length === 0;

  // Every rule this department applies, each evaluated by the same engine that
  // decided whether this page was visible at all. This replaced two inline
  // CGPA/backlog comparisons that could have disagreed with the real decision.
  // The final-year and marks requirements (Item 8) sit between the batch and
  // the drive's other rules — the order the evaluator decides in.
  const evaluation = evaluateStudentForDrive(studentWithAcademic, drive);
  const toRow = (key: string, row: { passed: boolean; description: string; actual: string | null; reason: string | null }) => ({ key, ...row });
  const ruleRows = evaluation.results.map((result) => toRow(`${result.rule.ruleType}:${result.rule.operator}`, result));
  const batchRows = ruleRows.filter((row) => row.key.startsWith('BATCH_YEAR:'));
  const checklistRows = [
    ...batchRows,
    ...evaluation.requirements.map((requirement) => toRow(requirement.code, requirement)),
    ...ruleRows.filter((row) => !row.key.startsWith('BATCH_YEAR:')),
  ];

  // Eligible departments, from the DriveEligibleDepartment relation
  const eligibleDeptIds = drive.eligibleDepartmentLinks.map((link) => link.departmentId);
  const eligibleDepts = await prisma.department.findMany({
    where: { id: { in: eligibleDeptIds } },
    select: { name: true },
  });
  const eligibleDeptNames = eligibleDepts.map((d) => d.name);

  // Structural checks the checklist shows alongside the rules.
  const deptCheck = eligibleDeptIds.includes(studentWithAcademic.departmentId);
  const deadlineCheck = driveStatus === 'open';

  // Package display
  const packageText = formatPackage(drive);

  // The plain drive row for the client apply card: relations and the rule set
  // stay on the server.
  const {
    eligibleDepartmentLinks: _links,
    eligibilityRules: _rules,
    department: _department,
    applicationForm: _form,
    recruitmentStages: _stages,
    cancellation: _cancellation,
    ...driveRow
  } = drive;
  void _cancellation;
  void _links;
  void _rules;
  void _department;
  void _form;
  void _stages;

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
              {drive.cancellation ? (
                <StatusBadge variant="red">Cancelled</StatusBadge>
              ) : driveStatus === 'open' ? (
                <StatusBadge variant="green">Open</StatusBadge>
              ) : driveStatus === 'upcoming' ? (
                <StatusBadge variant="amber">Opens soon</StatusBadge>
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
              Application Start Date
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {formatNextStageDate(drive.applicationStartDate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Next Stage Date
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {formatNextStageDate(drive.nextStageDate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Application End Date
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
          {/* Batch, final year, marks, then every other rule this department applies */}
          {checklistRows.map((result) => (
            <div
              key={result.key}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
            >
              <span
                style={{
                  fontSize: 18,
                  color: result.passed ? 'var(--teal)' : 'var(--red)',
                }}
              >
                {result.passed ? '✓' : '✗'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {result.description}
                  {result.actual !== null && (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {' '}
                      · You: {result.actual}
                    </span>
                  )}
                </div>
                {!result.passed && result.reason && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>
                    {result.reason}
                  </div>
                )}
              </div>
            </div>
          ))}

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

      {/* Role details — this department's version, resolved server-side */}
      {(drive.jobDescriptionText || drive.requirements || skills.length > 0) && (
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface-0)',
            marginBottom: 24,
            display: 'grid',
            gap: 16,
          }}
        >
          {drive.jobDescriptionText && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                About the role
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {drive.jobDescriptionText}
              </p>
            </div>
          )}

          {drive.requirements && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                Requirements
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {drive.requirements}
              </p>
            </div>
          )}

          {skills.length > 0 && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                Skills
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {skills.map((skill) => (
                  <span key={skill} className="badge badge-gray" style={{ fontSize: 12 }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selection Process */}
      {selectionRounds.length > 0 && (
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
            {/* Stored as a JSON array; this used to print the raw string. */}
            {selectionRounds.join(' → ')}
          </div>
        </div>
      )}

      {/* Drive Day Logistics — every field optional, so each line shows only when set. */}
      {(drive.venue ||
        drive.reportingTime ||
        drive.seatingAllocation ||
        drive.contactPerson ||
        drive.contactPhone ||
        drive.coordinatorEmail ||
        drive.pptLink ||
        drive.specialInstructions) && (
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
            {drive.seatingAllocation && (
              <div>
                <strong>Seating:</strong> {drive.seatingAllocation}
              </div>
            )}
            {(drive.contactPerson || drive.contactPhone || drive.coordinatorEmail) && (
              <div>
                <strong>Contact:</strong>{' '}
                {[drive.contactPerson, drive.contactPhone].filter(Boolean).join(', ')}
                {drive.coordinatorEmail && (
                  <>
                    {(drive.contactPerson || drive.contactPhone) && ' · '}
                    <a href={`mailto:${drive.coordinatorEmail}`} style={{ color: 'var(--accent)' }}>
                      {drive.coordinatorEmail}
                    </a>
                  </>
                )}
              </div>
            )}
            {drive.specialInstructions && (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                <strong>Instructions:</strong> {drive.specialInstructions}
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

      {/* A cancelled drive: only a student who applied still reaches it. */}
      {drive.cancellation && (
        <div
          className="card"
          style={{ marginBottom: 16, borderLeft: '3px solid var(--red, #c0392b)', fontSize: 13 }}
        >
          <strong>This drive has been cancelled.</strong> Your application is kept on record.
          {drive.cancellation.reason ? ` Reason: ${drive.cancellation.reason}` : ''}
        </div>
      )}

      {/* Apply Section — this department's own application form */}
      <ApplySection
        drive={serializePackageOffered(driveRow)}
        driveStatus={drive.cancellation ? 'closed' : driveStatus}
        hasApplied={hasApplied}
        reviewFields={buildApplicationReviewData(
          {
            student: studentWithAcademic,
            academic: studentWithAcademic.academic,
            skills: studentWithAcademic.skills,
            projects: studentWithAcademic.projects,
            certifications: studentWithAcademic.certifications,
          },
          drive.applicationForm ?? []
        )}
        eligible={isFullyEligible}
        ineligibilityReasons={ineligibilityReasons}
      />
    </div>
  );
}
