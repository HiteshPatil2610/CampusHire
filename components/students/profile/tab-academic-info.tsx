'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import FileAttachField from '@/components/ui/file-attach-field';
import { useToast } from '@/hooks/use-toast';
import { updateAcademicInfo } from '@/features/students/actions/profile-academic';
import { updateSemesterMarks } from '@/features/students/actions/profile-semester-marks';
import { useRegisterProfileSave } from './profile-save-context';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';
import type { EntryType } from '@prisma/client';
import {
  ENTRY_TYPE_LABELS,
  firstSemesterFor,
} from '@/features/students/utils/entry-type';

export interface TabAcademicInfoProps {
  profile: CompleteProfile;
}

interface SemesterRow {
  semester: number;
  sgpa: number | '';
  gradeCardUrl: string | null;
  isVerified: boolean;
}

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

const ENTRY_TYPE_OPTIONS: EntryType[] = ['REGULAR', 'DIPLOMA'];

const BACKLOG_OPTIONS = [
  { value: 0, label: 'No (0 Active Backlogs)' },
  { value: 1, label: '1 Active Backlog' },
  { value: 2, label: '2 Active Backlogs' },
  { value: 3, label: '3 Active Backlogs' },
  { value: 4, label: '4 or more Active Backlogs' },
];

/** "1st semester", "2nd semester", … */
function ordinalSemester(semester: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const remainder = semester % 100;
  const suffix =
    suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0];
  return `${semester}${suffix} semester`;
}

function ordinal(value: number): string {
  return ordinalSemester(value).replace(' semester', '');
}

export default function TabAcademicInfo({ profile }: TabAcademicInfoProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    entryType: (profile.academic?.entryType ?? 'REGULAR') as EntryType,
    tenthPercentage: profile.academic?.tenthPercentage ?? ('' as number | ''),
    tenthBoard: profile.academic?.tenthBoard ?? '',
    tenthYear: profile.academic?.tenthYear ?? ('' as number | ''),
    tenthMarksheetUrl: profile.academic?.tenthMarksheetUrl ?? null,
    twelfthPercentage:
      profile.academic?.twelfthPercentage ?? ('' as number | ''),
    twelfthBoard: profile.academic?.twelfthBoard ?? '',
    twelfthYear: profile.academic?.twelfthYear ?? ('' as number | ''),
    twelfthMarksheetUrl: profile.academic?.twelfthMarksheetUrl ?? null,
    diplomaPercentage:
      profile.academic?.diplomaPercentage ?? ('' as number | ''),
    diplomaBoard: profile.academic?.diplomaBoard ?? '',
    diplomaYear: profile.academic?.diplomaYear ?? ('' as number | ''),
    diplomaMarksheetUrl: profile.academic?.diplomaMarksheetUrl ?? null,
    currentCGPA: profile.academic?.currentCGPA ?? ('' as number | ''),
    currentSemester: profile.academic?.currentSemester ?? 1,
    activeBacklogs: profile.academic?.activeBacklogs ?? 0,
    pastBacklogCount: profile.academic?.pastBacklogCount ?? 0,
  });

  const [semesterRows, setSemesterRows] = useState<SemesterRow[]>(() =>
    profile.semesterMarks
      .slice()
      .sort((a, b) => a.semester - b.semester)
      .map((mark) => ({
        semester: mark.semester,
        sgpa: mark.sgpa,
        gradeCardUrl: mark.gradeCardUrl,
        isVerified: mark.isVerified,
      }))
  );

  const isDiploma = form.entryType === 'DIPLOMA';
  // A lateral-entry student joins in the second year, so their record starts
  // at semester 3 — semesters 1 and 2 never existed for them.
  const firstSemester = firstSemesterFor(form.entryType);

  // Results can only be recorded for semesters already completed, i.e. one
  // below the semester the student is currently in.
  const maxAllowedSem = Math.max(0, form.currentSemester - 1);
  const selectableSemesters = SEMESTER_OPTIONS.filter(
    (sem) => sem >= firstSemester && sem <= maxAllowedSem
  );
  const atLimit = semesterRows.length >= selectableSemesters.length;

  function updateSemester(index: number, patch: Partial<SemesterRow>) {
    setSemesterRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleAddSemester() {
    if (atLimit) return;

    const used = new Set(semesterRows.map((row) => row.semester));
    const nextSemester = selectableSemesters.find((sem) => !used.has(sem));
    if (!nextSemester) return;

    setSemesterRows([
      ...semesterRows,
      {
        semester: nextSemester,
        sgpa: '',
        gradeCardUrl: null,
        isVerified: false,
      },
    ]);
  }

  function handleRemoveSemester(index: number) {
    setSemesterRows((rows) => rows.filter((_, i) => i !== index));
  }

  /**
   * Switching to lateral entry drops the semester rows that entry type cannot
   * have, and lifts the current semester to the first one it can — otherwise
   * the form would submit a shape the server rejects.
   */
  function handleEntryTypeChange(entryType: EntryType) {
    const nextFirst = firstSemesterFor(entryType);

    setForm((prev) => ({
      ...prev,
      entryType,
      currentSemester: Math.max(prev.currentSemester, nextFirst),
    }));
    setSemesterRows((rows) => rows.filter((row) => row.semester >= nextFirst));
  }

  function handleSave() {
    const preCollegeMissing = isDiploma
      ? form.diplomaPercentage === ''
      : form.twelfthPercentage === '';

    if (
      form.tenthPercentage === '' ||
      preCollegeMissing ||
      form.currentCGPA === ''
    ) {
      toast({
        title: 'Validation error',
        description: isDiploma
          ? 'Percentage for 10th and your diploma, and your current CGPA, are required.'
          : 'Percentage for 10th and 12th and your current CGPA are required.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const academicResult = await updateAcademicInfo({
        tenthPercentage: Number(form.tenthPercentage),
        tenthBoard: form.tenthBoard.trim() || undefined,
        tenthYear: form.tenthYear === '' ? undefined : Number(form.tenthYear),
        tenthMarksheetUrl: form.tenthMarksheetUrl,
        entryType: form.entryType,
        // Only the branch matching the entry type is sent; the server clears
        // the other one.
        twelfthPercentage: isDiploma ? null : Number(form.twelfthPercentage),
        twelfthBoard: isDiploma
          ? undefined
          : form.twelfthBoard.trim() || undefined,
        twelfthYear:
          isDiploma || form.twelfthYear === ''
            ? undefined
            : Number(form.twelfthYear),
        twelfthMarksheetUrl: isDiploma ? null : form.twelfthMarksheetUrl,
        diplomaPercentage: isDiploma ? Number(form.diplomaPercentage) : null,
        diplomaBoard: isDiploma
          ? form.diplomaBoard.trim() || undefined
          : undefined,
        diplomaYear:
          !isDiploma || form.diplomaYear === ''
            ? undefined
            : Number(form.diplomaYear),
        diplomaMarksheetUrl: isDiploma ? form.diplomaMarksheetUrl : null,
        currentCGPA: Number(form.currentCGPA),
        currentSemester: form.currentSemester,
        activeBacklogs: form.activeBacklogs,
        pastBacklogCount: form.pastBacklogCount,
      });

      if (!academicResult.success) {
        toast({
          title: 'Error',
          description: academicResult.error ?? 'Failed to save.',
          variant: 'destructive',
        });
        return;
      }

      const semesterResult = await updateSemesterMarks({
        entryType: form.entryType,
        marks: semesterRows
          .filter((row) => row.sgpa !== '')
          .map((row) => ({
            semester: row.semester,
            sgpa: Number(row.sgpa),
            gradeCardUrl: row.gradeCardUrl,
          })),
      });

      if (!semesterResult.success) {
        toast({
          title: 'Error',
          description:
            semesterResult.error ?? 'Failed to save semester results.',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Saved', description: 'Academic details updated.' });
      router.refresh();
    });
  }

  useRegisterProfileSave(handleSave, isPending);

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 18 }}>
        Academic Credentials
      </h3>

      {/*
        Entry type decides which pre-college record is asked for and which
        semesters exist. Changing it rewrites both below.
      */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>How did you enter this degree? *</label>
          <select
            value={form.entryType}
            onChange={(e) => handleEntryTypeChange(e.target.value as EntryType)}
          >
            {ENTRY_TYPE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {ENTRY_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="panel-hint" style={{ marginTop: 8 }}>
            <Info size={12} aria-hidden />
            {isDiploma
              ? 'Lateral entry: submit your diploma instead of 12th, and record marks from semester 3 onwards.'
              : 'Regular entry: submit your 12th record and record marks from semester 1 onwards.'}
          </p>
        </div>
      </div>

      {/* 10th / 12th */}
      <div className="field-row" style={{ marginBottom: 18 }}>
        <div className="panel">
          <div className="panel-head">
            <strong className="panel-title">10th Secondary School</strong>
            <span className="required-tag">* Required</span>
          </div>

          <div className="field">
            <label>Percentage / CGPA *</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.tenthPercentage}
              onChange={(e) =>
                setForm({
                  ...form,
                  tenthPercentage:
                    e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
          </div>

          <div className="field">
            <label>Board &amp; Year *</label>
            <div className="field-row" style={{ gap: 10 }}>
              <input
                value={form.tenthBoard}
                placeholder="CBSE"
                onChange={(e) =>
                  setForm({ ...form, tenthBoard: e.target.value })
                }
              />
              <input
                type="number"
                min={1950}
                max={2100}
                placeholder="2019"
                value={form.tenthYear}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tenthYear:
                      e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <FileAttachField
            kind="tenth-marksheet"
            value={form.tenthMarksheetUrl}
            onChange={(tenthMarksheetUrl) =>
              setForm({ ...form, tenthMarksheetUrl })
            }
            placeholder="Attach 10th marksheet"
          />
        </div>

        {/*
          A student submits one pre-college record or the other, never both:
          a lateral-entry student has no 12th, and a regular student has no
          diploma. Only the applicable panel is rendered.
        */}
        {isDiploma ? (
          <div className="panel">
            <div className="panel-head">
              <strong className="panel-title">Diploma</strong>
              <span className="required-tag">* Required</span>
            </div>

            <div className="field">
              <label>Percentage / CGPA *</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.diplomaPercentage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    diplomaPercentage:
                      e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="field">
              <label>Board &amp; Year *</label>
              <div className="field-row" style={{ gap: 10 }}>
                <input
                  value={form.diplomaBoard}
                  placeholder="MSBTE"
                  onChange={(e) =>
                    setForm({ ...form, diplomaBoard: e.target.value })
                  }
                />
                <input
                  type="number"
                  min={1950}
                  max={2100}
                  placeholder="2023"
                  value={form.diplomaYear}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      diplomaYear:
                        e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <FileAttachField
              kind="diploma-marksheet"
              value={form.diplomaMarksheetUrl}
              onChange={(diplomaMarksheetUrl) =>
                setForm({ ...form, diplomaMarksheetUrl })
              }
              placeholder="Attach diploma marksheet"
            />
          </div>
        ) : (
          <div className="panel">
            <div className="panel-head">
              <strong className="panel-title">12th Higher Secondary</strong>
              <span className="required-tag">* Required</span>
            </div>

            <div className="field">
              <label>Percentage / CGPA *</label>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.twelfthPercentage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    twelfthPercentage:
                      e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="field">
              <label>Board &amp; Year *</label>
              <div className="field-row" style={{ gap: 10 }}>
                <input
                  value={form.twelfthBoard}
                  placeholder="CBSE"
                  onChange={(e) =>
                    setForm({ ...form, twelfthBoard: e.target.value })
                  }
                />
                <input
                  type="number"
                  min={1950}
                  max={2100}
                  placeholder="2021"
                  value={form.twelfthYear}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      twelfthYear:
                        e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <FileAttachField
              kind="twelfth-marksheet"
              value={form.twelfthMarksheetUrl}
              onChange={(twelfthMarksheetUrl) =>
                setForm({ ...form, twelfthMarksheetUrl })
              }
              placeholder="Attach 12th marksheet"
            />
          </div>
        )}
      </div>

      {/* Current standing */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Current Cumulative CGPA *</label>
            <input
              type="number"
              min={0}
              max={10}
              step="0.01"
              value={form.currentCGPA}
              onChange={(e) =>
                setForm({
                  ...form,
                  currentCGPA:
                    e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Current Semester *</label>
            <select
              value={form.currentSemester}
              onChange={(e) =>
                setForm({ ...form, currentSemester: Number(e.target.value) })
              }
            >
              {SEMESTER_OPTIONS.filter((sem) => sem >= firstSemester).map(
                (sem) => (
                  <option key={sem} value={sem}>
                    {ordinalSemester(sem)}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Semester grade breakdown */}
      <div className="panel panel-plain" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <strong className="panel-title">Semester Grade Breakdown</strong>
          <span className="badge badge-accent">
            {semesterRows.length} of {selectableSemesters.length} allowed
            recorded
          </span>
        </div>

        <p className="panel-hint">
          <Info size={12} aria-hidden />
          You can add results for Semester {firstSemester} to {maxAllowedSem}{' '}
          (one below your current semester: {ordinal(form.currentSemester)}).
          {isDiploma &&
            ' Semesters 1 and 2 do not apply to a lateral-entry student.'}
        </p>

        {semesterRows.length > 0 && (
          <div className="semester-grid">
            {semesterRows.map((row, index) => (
              <div key={row.semester} className="semester-card">
                <div className="semester-card-head">
                  <strong>Sem {row.semester}</strong>
                  {row.isVerified ? (
                    <span className="verified-chip">✓ Verified</span>
                  ) : (
                    <span className="pending-chip">Pending</span>
                  )}
                  <button
                    type="button"
                    className="semester-remove"
                    onClick={() => handleRemoveSemester(index)}
                    aria-label={`Remove semester ${row.semester}`}
                    title="Remove this semester"
                  >
                    ×
                  </button>
                </div>

                <div className="field" style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11 }}>SGPA</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step="0.01"
                    value={row.sgpa}
                    onChange={(e) =>
                      updateSemester(index, {
                        sgpa:
                          e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                  />
                </div>

                <FileAttachField
                  size="sm"
                  kind="grade-card"
                  value={row.gradeCardUrl}
                  onChange={(gradeCardUrl) =>
                    updateSemester(index, { gradeCardUrl })
                  }
                  placeholder="Attach grade card"
                />
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginTop: 14,
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={atLimit}
            onClick={handleAddSemester}
          >
            + Add semester result
          </button>
          {atLimit && (
            <span style={{ fontSize: 12, color: 'var(--accent-dark)' }}>
              Maximum semester results reached for your current semester (
              {ordinal(form.currentSemester)}).
            </span>
          )}
        </div>
      </div>

      {/* Backlogs */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <strong className="panel-title">
            Backlog History &amp; Academic Standing
          </strong>
        </div>

        <div className="field-row" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Active Backlogs *</label>
            <select
              value={form.activeBacklogs}
              onChange={(e) =>
                setForm({ ...form, activeBacklogs: Number(e.target.value) })
              }
            >
              {BACKLOG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Past Backlog History Count</label>
            <input
              type="number"
              min={0}
              value={form.pastBacklogCount}
              onChange={(e) =>
                setForm({
                  ...form,
                  pastBacklogCount: Number(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="tab-footer">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
