'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getStudentDetailForAdmin } from '@/features/students/actions/get-student-detail-for-admin';
import { calculateProfileCompletion, type CompleteProfile } from '@/features/students/queries/profile-completion';

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
 */
export function StudentDetailsDialog({
  studentId,
  onClose,
}: StudentDetailsDialogProps) {
  const [profile, setProfile] = useState<CompleteProfile | null>(null);
  const [loading, setLoading] = useState(false);
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
  }, [studentId, onClose, toast]);

  if (!studentId) return null;

  const student = profile?.student;
  const academic = profile?.academic;
  const skills = profile?.skills || [];

  // Calculate profile completion
  const profileCompletion = profile
    ? calculateProfileCompletion(profile)
    : { percentage: 0, completedSections: [], missingSections: [] };

  // Determine status
  const isPlaced = student?.placementStatus === 'placed';
  const isPending = student?.isPending === true;
  const needsAttention =
    !isPlaced && !isPending && (academic?.activeBacklogs ?? 0) > 0;

  // Status badge
  let statusBadge = { text: 'Eligible for Drives', className: 'badge-purple' };
  if (isPending) {
    statusBadge = { text: 'Pending Registration', className: 'badge-amber' };
  } else if (isPlaced) {
    statusBadge = { text: 'Placed', className: 'badge-green' };
  } else if (needsAttention) {
    statusBadge = { text: 'Needs Attention', className: 'badge-red' };
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
                    Roll No: <strong>{student.rollNumber}</strong> · Dept:{' '}
                    <strong>{student.department.code}</strong>
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
