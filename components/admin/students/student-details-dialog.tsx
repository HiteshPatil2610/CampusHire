'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getStudentDetailForAdmin } from '@/features/students/actions/get-student-detail-for-admin';
import { calculateProfileCompletion, type CompleteProfile } from '@/features/students/queries/profile-completion';
import { setStudentPlacementOptIn } from '@/features/students/actions/set-placement-opt-in';
import {
  PLACEMENT_STATE_BADGES,
  resolvePlacementState,
} from '@/features/students/utils/placement-status';
import { StudentPlacementPanel } from './student-placement-panel';
import { StudentAcademicPanel } from './student-academic-panel';
import { formatBatch } from '@/features/students/utils/batch';

interface StudentDetailsDialogProps {
  studentId: string | null; // null = closed
  onClose: () => void;
}

/**
 * Student Details Dialog for Department Admin
 * 
 * Fetches full student profile when opened and displays in a modal.
 * Uses getStudentDetailForAdmin which enforces department scope.
 * 
 * V1 Changes from temp frontend:
 * - Removed readiness and resume score KPIs (out of scope)
 * - Added profile completion % instead
 * - Maps temp frontend field names to Prisma schema
 *
 * Placement state is derived from the student's active placement records
 * (StudentPlacement). The admin can see the placement history, record an
 * off-campus placement or revoke a mistaken one, and set and lock the
 * student's placement participation, from here.
 */
export function StudentDetailsDialog({
  studentId,
  onClose,
}: StudentDetailsDialogProps) {
  const [profile, setProfile] = useState<CompleteProfile | null>(null);
  const [loading, setLoading] = useState(false);
  // Bumped after a placement change so the profile (and its badge) reloads.
  const [reloadKey, setReloadKey] = useState(0);
  const [isSavingOptIn, startOptInTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (!studentId) {
      setProfile(null);
      return;
    }

    setLoading(true);
    getStudentDetailForAdmin(studentId)
      .then((result) => {
        setProfile(result);
      })
      .catch((err) => {
        toast({
          title: 'Error',
          description: err.message || 'Failed to load student details',
          variant: 'destructive',
        });
        onClose();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentId, onClose, toast, reloadKey]);

  if (!studentId) return null;

  const student = profile?.student;
  const academic = profile?.academic;
  const skills = profile?.skills || [];

  // Calculate profile completion
  const profileCompletion = profile
    ? calculateProfileCompletion(profile)
    : { percentage: 0, completedSections: [], missingSections: [] };

  // Placement comes from the student's active placement records.
  const offers = profile?.selectedOffers ?? [];
  const isPlaced = offers.length > 0;
  const isPending = student?.isPending === true;
  const optedIn = student?.optedIn ?? true;
  const optedInLocked = student?.optedInLocked ?? false;
  const needsAttention =
    !isPlaced && !isPending && optedIn && (academic?.activeBacklogs ?? 0) > 0;

  const placementState = resolvePlacementState({
    isPending,
    optedIn,
    isPlaced,
  });

  // Needs Attention outranks the plain Eligible badge, but never overrides a
  // real outcome (placed / pending / opted out).
  const statusBadge =
    placementState === 'ELIGIBLE' && needsAttention
      ? { text: 'Needs Attention', className: 'badge-red' }
      : PLACEMENT_STATE_BADGES[placementState];

  function handleOptInChange(nextOptedIn: boolean, nextLocked: boolean) {
    if (!studentId) return;

    startOptInTransition(async () => {
      const result = await setStudentPlacementOptIn({
        studentId,
        optedIn: nextOptedIn,
        locked: nextLocked,
      });

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      // Keep the open dialog consistent with what was just saved.
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              student: {
                ...prev.student,
                optedIn: nextOptedIn,
                optedInLocked: nextLocked,
              },
            }
          : prev
      );

      toast({
        title: 'Updated',
        description: nextOptedIn
          ? 'Student is participating in placement.'
          : 'Student is marked as opted out of placement.',
      });
    });
  }

  // Generate initials
  const initials = student
    ? student.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'S';

  return (
    <Dialog open={!!studentId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        style={{
          maxWidth: 800,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <DialogHeader>
          <DialogTitle>Student Placement & Academic Record</DialogTitle>
        </DialogHeader>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
              Loading student details...
            </p>
          </div>
        )}

        {!loading && student && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header summary banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 8,
                background: 'var(--surface-hover)',
                border: '0.5px solid var(--border)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {student.name}
                  </div>
                  <div
                    style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                  >
                    MIS: <strong>{student.misNumber ?? '—'}</strong> · Roll No:{' '}
                    <strong>{student.rollNumber}</strong> · Dept:{' '}
                    <strong>{student.department.code}</strong> · Batch:{' '}
                    <strong>{formatBatch(student.expectedPassoutYear)}</strong>
                    {student.prnNumber && (
                      <> · PRN: <strong>{student.prnNumber}</strong></>
                    )}
                    {academic?.currentSemester && (
                      <> (Sem {academic.currentSemester})</>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${statusBadge.className}`}>
                  {statusBadge.text}
                </span>
              </div>
            </div>

            {/* Academic standing — year level, batch and drops */}
            <StudentAcademicPanel
              studentId={studentId}
              onChanged={() => setReloadKey((key) => key + 1)}
            />

            {/* Placement — the source of the Placed state */}
            <StudentPlacementPanel
              studentId={studentId}
              canRecord
              onChanged={() => setReloadKey((key) => key + 1)}
            />

            {/* Placement participation — admin-controlled, lockable */}
            <div
              className="card"
              style={{
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Placement participation
                </div>
                <div
                  className="text-muted"
                  style={{ fontSize: 11, marginTop: 2 }}
                >
                  {optedInLocked
                    ? 'Locked — the student cannot change this themselves.'
                    : 'The student can also change this from their settings.'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    optedIn ? 'btn-primary' : 'btn-outline'
                  }`}
                  disabled={isSavingOptIn}
                  onClick={() => handleOptInChange(true, optedInLocked)}
                >
                  Participating
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${
                    !optedIn ? 'btn-primary' : 'btn-outline'
                  }`}
                  disabled={isSavingOptIn}
                  onClick={() => handleOptInChange(false, optedInLocked)}
                >
                  Opted Out
                </button>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={optedInLocked}
                    disabled={isSavingOptIn}
                    onChange={(e) =>
                      handleOptInChange(optedIn, e.target.checked)
                    }
                  />
                  Lock
                </label>
              </div>
            </div>

            {/* Academic metrics grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              <div
                className="card"
                style={{ padding: '10px 12px', textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                  }}
                >
                  CGPA
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    marginTop: 2,
                  }}
                >
                  {academic?.currentCGPA ?? '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  out of 10.0
                </div>
              </div>

              <div
                className="card"
                style={{ padding: '10px 12px', textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                  }}
                >
                  Backlogs
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color:
                      (academic?.activeBacklogs ?? 0) > 0
                        ? 'var(--red, #ef4444)'
                        : 'var(--green, #10b981)',
                    marginTop: 2,
                  }}
                >
                  {academic?.activeBacklogs ?? 0}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {(academic?.activeBacklogs ?? 0) > 0
                    ? 'Active backlog'
                    : 'Zero backlogs'}
                </div>
              </div>

              <div
                className="card"
                style={{ padding: '10px 12px', textAlign: 'center' }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                  }}
                >
                  Profile
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    marginTop: 2,
                  }}
                >
                  {profileCompletion.percentage}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  Completion
                </div>
              </div>
            </div>

            {/* Secondary Details & Academics */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
            >
              {/* Institutional Records */}
              <div className="card" style={{ padding: 14 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>🔒</span> Institutional Records
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Department:
                    </span>
                    <strong>{student.department.code}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Current Semester:
                    </span>
                    <span>{academic?.currentSemester ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      10th Percentage:
                    </span>
                    <span>{academic?.tenthPercentage ?? '—'}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      12th / Diploma %:
                    </span>
                    <span>{academic?.twelfthPercentage ?? '—'}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Registry Status:
                    </span>
                    <span
                      style={{
                        color: isPending
                          ? 'var(--amber, #f59e0b)'
                          : 'var(--green, #10b981)',
                        fontWeight: 600,
                      }}
                    >
                      {isPending ? '⏳ Pending' : '✓ Verified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="card" style={{ padding: 14 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📞</span> Student Contact & Profiles
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      College Email:
                    </span>
                    <span style={{ wordBreak: 'break-all' }}>
                      {student.email}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Mobile Phone:
                    </span>
                    <span>{student.phoneNumber ?? '—'}</span>
                  </div>
                  {student.linkedinUrl && (
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>
                        LinkedIn:
                      </span>
                      <a
                        href={student.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        View Profile ↗
                      </a>
                    </div>
                  )}
                  {student.githubUrl && (
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between' }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>
                        GitHub:
                      </span>
                      <a
                        href={student.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        View Code ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Technical Skills & Proficiencies
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.map((skill: { id: string; skillName: string }) => (
                    <span
                      key={skill.id}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: 'var(--surface-hover)',
                        border: '0.5px solid var(--border)',
                        fontWeight: 500,
                      }}
                    >
                      {skill.skillName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
