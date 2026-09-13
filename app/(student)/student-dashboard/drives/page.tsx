import { requireStudent } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEligibleDrives } from '@/features/drives/queries/get-eligible-drives';
import { checkApplicationExists } from '@/features/applications/queries/check-application-exists';
import { getDriveDisplayStatus } from '@/features/drives/utils/drive-status';
import { calculateProfileCompletion } from '@/features/students/queries/profile-completion';
import { DrivesFilterBar } from '@/components/drives/drives-filter-bar';
import { DrivesGrid } from '@/components/drives/drives-grid';
import Link from 'next/link';

interface DrivesPageProps {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    page?: string;
  }>;
}

/**
 * Student Drives Catalogue Page
 * 
 * Shows eligible drives with filtering and pagination
 * Server-side eligibility filtering - students only see drives they qualify for
 */
export default async function DrivesPage({ searchParams }: DrivesPageProps) {
  // Authenticate and get student
  const { user, student } = await requireStudent();

  // Get complete student profile for identity card
  const studentWithProfile = await prisma.student.findUnique({
    where: { id: student.id },
    include: {
      department: { select: { id: true, name: true, code: true } },
      academic: true,
      skills: true,
      projects: true,
      experiences: true,
      certifications: true,
      preferences: true,
      semesterMarks: true,
    },
  });

  if (!studentWithProfile) {
    throw new Error('Student profile not found');
  }

  // Calculate profile completion
  const profileCompletion = calculateProfileCompletion({
    student: studentWithProfile,
    academic: studentWithProfile.academic,
    semesterMarks: studentWithProfile.semesterMarks,
    skills: studentWithProfile.skills,
    projects: studentWithProfile.projects,
    experiences: studentWithProfile.experiences,
    certifications: studentWithProfile.certifications,
    preferences: studentWithProfile.preferences,
  });

  // Parse search params
  const params = await searchParams;
  const filter = params.filter || 'all';
  const search = params.q;
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;

  // Get eligible drives based on filter
  let status: 'open' | 'all' = 'all';
  if (filter === 'open') {
    status = 'open';
  }

  const drivesResult = await getEligibleDrives({
    status,
    search,
    page,
    pageSize,
  });

  // Build applied drives set
  const appliedDriveIds = new Set<string>();
  for (const drive of drivesResult.data) {
    const hasApplied = await checkApplicationExists(student.id, drive.id);
    if (hasApplied) {
      appliedDriveIds.add(drive.id);
    }
  }

  // Apply client-side filters for 'applied', 'upcoming', 'closed'
  let filteredDrives = drivesResult.data;
  let filteredTotalCount = drivesResult.totalCount;

  if (filter === 'applied') {
    filteredDrives = drivesResult.data.filter((d) => appliedDriveIds.has(d.id));
    filteredTotalCount = filteredDrives.length;
  } else if (filter === 'upcoming') {
    // Applications closed, but the drive itself hasn't been held yet —
    // same rule the card badge uses, so pill and badge agree.
    filteredDrives = drivesResult.data.filter(
      (d) => getDriveDisplayStatus(d.applicationDeadline, d.driveDate) === 'upcoming'
    );
    filteredTotalCount = filteredDrives.length;
  } else if (filter === 'closed') {
    filteredDrives = drivesResult.data.filter(
      (d) => getDriveDisplayStatus(d.applicationDeadline, d.driveDate) === 'closed'
    );
    filteredTotalCount = filteredDrives.length;
  }

  // Get all departments for mapping
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.code]));

  // Get applicant counts (optional - can be expensive for many drives)
  const applicantCounts: Record<string, number> = {};
  for (const drive of filteredDrives) {
    const count = await prisma.driveApplication.count({
      where: { driveId: drive.id },
    });
    applicantCounts[drive.id] = count;
  }

  // Year of study derived from the real current semester (2 semesters per year)
  const YEAR_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
  const currentSemester = studentWithProfile.academic?.currentSemester;
  const studyYear = currentSemester
    ? YEAR_LABELS[Math.ceil(currentSemester / 2) - 1] ?? null
    : null;

  // Generate initials
  const nameParts = studentWithProfile.name.trim().split(/\s+/);
  const initials = nameParts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Student Identity Card */}
      <div
        className="student-id-card"
        style={{
          display: 'flex',
          gap: 20,
          padding: 20,
          marginBottom: 24,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          alignItems: 'center',
          borderTop: '3px solid transparent',
          borderImage:
            'linear-gradient(90deg, var(--accent) 0%, var(--amber) 45%, var(--teal) 100%) 1',
          borderImageWidth: '3px 0 0 0',
        }}
      >
        <Link
          href="/student-dashboard/profile"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
            flexShrink: 0,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          {initials}
        </Link>

        <div style={{ flex: 1 }}>
          <div
            className="sid-name"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}
          >
            {studentWithProfile.name}
          </div>
          <div
            className="sid-meta"
            style={{
              display: 'flex',
              gap: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
            }}
          >
            <span>{studentWithProfile.department.code}</span>
            {studyYear && <span>{studyYear} year</span>}
            <span>Roll {studentWithProfile.rollNumber}</span>
            {studentWithProfile.academic && (
              <span>CGPA {studentWithProfile.academic.currentCGPA}</span>
            )}
            <span>{studentWithProfile.email}</span>
          </div>
          <div
            className="sid-scores"
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 8,
            }}
          >
            <span
              className="sid-score-pill profile"
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 11,
                fontWeight: 600,
                background: 'var(--accent-surface)',
                color: 'var(--accent)',
              }}
            >
              Profile {profileCompletion.percentage}%
            </span>
          </div>
        </div>

        <div
          className="sid-actions"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Link
            href="/student-dashboard/profile"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: 'white',
              textDecoration: 'none',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            Edit profile
          </Link>
          <Link
            href="/student-dashboard/applications"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface-0)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            My Applications
          </Link>
        </div>
      </div>

      {/* Page Title */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 4,
          }}
        >
          Placement Drives
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          Browse and apply to drives you&apos;re eligible for
        </p>
      </div>

      {/* Filter Bar */}
      <DrivesFilterBar
        appliedCount={appliedDriveIds.size}
        upcomingCount={undefined}
        closedCount={undefined}
      />

      {/* Drives Grid */}
      <DrivesGrid
        drives={filteredDrives}
        appliedDriveIds={appliedDriveIds}
        departmentMap={deptMap}
        page={page}
        pageSize={pageSize}
        totalCount={filteredTotalCount}
        applicantCounts={applicantCounts}
        hasAcademicProfile={Boolean(studentWithProfile.academic)}
      />
    </div>
  );
}
