import { requireStudent } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getEligibleDrives } from '@/features/drives/queries/get-eligible-drives';
import { getAppliedDriveIds } from '@/features/applications/queries/get-applied-drive-ids';
import { ACTIVE_PLACEMENT_WHERE } from '@/features/students/utils/placement-status';
import { getDriveDisplayStatus } from '@/features/drives/utils/drive-status';
import { calculateProfileCompletion } from '@/features/students/queries/profile-completion';
import { DrivesFilterBar } from '@/components/drives/drives-filter-bar';
import { DrivesGrid } from '@/components/drives/drives-grid';
import Link from 'next/link';
import { YEAR_LEVEL_LABELS, yearLevelFor } from '@/features/students/domain/academic-year';

export const dynamic = 'force-dynamic';

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
 * Shows eligible drives with filtering and pagination.
 * All eligibility filtering is server-side — students only see drives they
 * qualify for.
 *
 * Performance: two N+1 loops were replaced with a single getAppliedDriveIds
 * call (one query) and a driveApplication groupBy (one query), regardless of
 * how many drives are on the page.
 */
export default async function DrivesPage({ searchParams }: DrivesPageProps) {
  const { user, student } = await requireStudent();

  const params = await searchParams;
  const filter = params.filter || 'all';
  const search = params.q;
  const page = parseInt(params.page || '1', 10);
  const pageSize = 25;

  // Fetch student profile, eligible drives, and applied drive IDs in parallel.
  const [studentWithProfile, appliedDriveIds, drivesResult] = await Promise.all([
    prisma.student.findUnique({
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
        placements: {
          where: ACTIVE_PLACEMENT_WHERE,
          select: {
            id: true,
            driveId: true,
            companyName: true,
            roleName: true,
            packageDisplay: true,
          },
        },
      },
    }),
    getAppliedDriveIds(student.id),
    getEligibleDrives({
      status: filter === 'open' ? 'open' : 'all',
      search,
      page,
      pageSize,
    }),
  ]);

  if (!studentWithProfile) {
    throw new Error('Student profile not found');
  }

  const profileCompletion = calculateProfileCompletion({
    student: studentWithProfile,
    academic: studentWithProfile.academic,
    semesterMarks: studentWithProfile.semesterMarks,
    skills: studentWithProfile.skills,
    projects: studentWithProfile.projects,
    experiences: studentWithProfile.experiences,
    certifications: studentWithProfile.certifications,
    preferences: studentWithProfile.preferences,
    selectedOffers: studentWithProfile.placements.map((p) => ({
      placementId: p.id,
      driveId: p.driveId,
      companyName: p.companyName,
      roleName: p.roleName,
      packageDisplay: p.packageDisplay,
    })),
  });

  const appliedSet = new Set(appliedDriveIds);

  // Apply client-side filters for 'applied', 'upcoming', 'closed'
  let filteredDrives = drivesResult.data;
  let filteredTotalCount = drivesResult.totalCount;

  if (filter === 'applied') {
    filteredDrives = drivesResult.data.filter((d) => appliedSet.has(d.id));
    filteredTotalCount = filteredDrives.length;
  } else if (filter === 'upcoming') {
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

  // Departments map and applicant counts — both single queries.
  const driveIds = filteredDrives.map((d) => d.id);
  const [departments, applicantCountRows] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    }),
    driveIds.length > 0
      ? prisma.driveApplication.groupBy({
          by: ['driveId'],
          where: { driveId: { in: driveIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.code]));
  const applicantCounts: Record<string, number> = {};
  for (const row of applicantCountRows) {
    applicantCounts[row.driveId] = row._count._all;
  }

  // Year of study is derived from the batch (expected passout year) and the
  // academic cycle — the one definition, in academic-year.ts.
  const yearLevel = yearLevelFor(studentWithProfile.expectedPassoutYear);
  const studyYear = yearLevel ? YEAR_LEVEL_LABELS[yearLevel] : null;

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
        style={{
          display: 'flex',
          gap: 20,
          padding: 20,
          marginBottom: 24,
          borderRadius: 12,
          border: '0.5px solid var(--border)',
          background: 'var(--surface-2)',
          alignItems: 'center',
          borderTop: '3px solid var(--accent)',
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
            textDecoration: 'none',
          }}
        >
          {initials}
        </Link>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            {studentWithProfile.name}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
            }}
          >
            <span>{studentWithProfile.department.code}</span>
            {studyYear && <span>{studyYear}</span>}
            {studentWithProfile.rollNumber && (
              <span>Roll {studentWithProfile.rollNumber}</span>
            )}
            {studentWithProfile.academic && (
              <span>CGPA {studentWithProfile.academic.currentCGPA}</span>
            )}
            <span>{studentWithProfile.email}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 11,
                fontWeight: 600,
                background: 'var(--accent-light)',
                color: 'var(--accent)',
              }}
            >
              Profile {profileCompletion.percentage}%
            </span>
            {studentWithProfile.placements.length > 0 && (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 11,
                  fontWeight: 600,
                  background: 'var(--teal-light)',
                  color: 'var(--teal)',
                }}
              >
                ✓ Placed — {studentWithProfile.placements[0].companyName}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link
            href="/student-dashboard/profile"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'white',
              textDecoration: 'none',
              textAlign: 'center',
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
              border: '0.5px solid var(--border-strong)',
              background: 'var(--surface-0)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            My Applications
          </Link>
        </div>
      </div>

      {/* Page title */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          Placement Drives
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
          Browse and apply to drives you&apos;re eligible for
        </p>
      </div>

      {/* Placed banner — placed students see drives they already applied to,
          but cannot apply to new ones */}
      {studentWithProfile.placements.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'var(--teal-light)',
            border: '0.5px solid var(--teal)',
            fontSize: 13,
            color: 'var(--teal)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontWeight: 600 }}>✓ You are placed</span>
          <span>
            at {studentWithProfile.placements[0].companyName}. You can review your
            application history below, but new drives are no longer available.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <DrivesFilterBar
        appliedCount={appliedSet.size}
        upcomingCount={undefined}
        closedCount={undefined}
      />

      {/* Drives Grid */}
      <DrivesGrid
        drives={filteredDrives}
        appliedDriveIds={appliedSet}
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
