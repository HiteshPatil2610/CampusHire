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
import {
  allowedCurrentSemesters,
  cgpaConsistencyProblem,
  currentAcademicYearLabel,
  isCgpaExpected,
} from '@/features/students/domain/academic-standing';
import {
  cgpaToPercentage,
  scoreModeOf,
  type ScoreMode,
} from '@/features/students/utils/score-conversion';

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

/**
 * A pre-college score, given the way the board gave it: a percentage, or a
 * CGPA out of 10 (converted to a percentage for eligibility on save).
 */
function ScoreField({
  label,
  mode,
  onModeChange,
  percentage,
  cgpa,
  onPercentageChange,
  onCgpaChange,
}: {
  label: string;
  mode: ScoreMode;
  onModeChange: (mode: ScoreMode) => void;
  percentage: number | '';
  cgpa: number | '';
  onPercentageChange: (value: number | '') => void;
  onCgpaChange: (value: number | '') => void;
}) {
  const toValue = (raw: string) => (raw === '' ? '' : Number(raw));
  return (
    <div className="field">
      <div className="field-label-row">
        <label>{label} *</label>
        <div className="gender-toggle" role="group" aria-label={`${label} given as`}>
          {(['PERCENTAGE', 'CGPA'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`gender-btn${mode === option ? ' active' : ''}`}
              style={{ padding: '3px 10px', fontSize: 11 }}
              aria-pressed={mode === option}
              onClick={() => onModeChange(option)}
            >
              {option === 'PERCENTAGE' ? '%' : 'CGPA'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'PERCENTAGE' ? (
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          placeholder="e.g. 86.4"
          value={percentage}
          onChange={(e) => onPercentageChange(toValue(e.target.value))}
        />
      ) : (
        <>
          <input
            type="number"
            min={0}
            max={10}
            step="0.01"
            placeholder="e.g. 9.2 (out of 10)"
            value={cgpa}
            onChange={(e) => onCgpaChange(toValue(e.target.value))}
          />
          <p className="field-hint">
            {cgpa === ''
              ? 'Your board’s CGPA out of 10. It is converted to a percentage (× 9.5) for drive eligibility.'
              : `Counts as ${cgpaToPercentage(Number(cgpa))}% for drive eligibility (CGPA × 9.5).`}
          </p>
        </>
      )}
    </div>
  );
}

export default function TabAcademicInfo({ profile }: TabAcademicInfoProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const entryType = profile.student.entryType as EntryType;
  // The semesters this batch can be in this academic year; the student picks
  // one of them (domain/academic-standing.ts).
  const allowedSemesters = allowedCurrentSemesters(
    entryType,
    profile.student.expectedPassoutYear
  );

  const [form, setForm] = useState({
    // Chosen at registration and fixed thereafter — see the read-only panel
    // below. Kept in form state so the branch logic can read it.
    entryType,
    // How each pre-college record was given: a percentage, or a board CGPA.
    tenthMode: scoreModeOf(profile.academic?.tenthCgpa),
    tenthCgpa: profile.academic?.tenthCgpa ?? ('' as number | ''),
    twelfthMode: scoreModeOf(profile.academic?.twelfthCgpa),
    twelfthCgpa: profile.academic?.twelfthCgpa ?? ('' as number | ''),
    diplomaMode: scoreModeOf(profile.academic?.diplomaCgpa),
    diplomaCgpa: profile.academic?.diplomaCgpa ?? ('' as number | ''),
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
    // A saved value from last year is kept (and flagged below) rather than
    // silently replaced, so the student sees it needs updating.
    currentSemester: profile.academic?.currentSemester ?? allowedSemesters[0],
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
  // Rows for semesters not finished yet (the student moved their current
  // semester back) are shown flagged, and dropped on save.
  const validRows = semesterRows.filter((row) =>
    selectableSemesters.includes(row.semester)
  );
  const atLimit = validRows.length >= selectableSemesters.length;
  const semesterIsStale = !allowedSemesters.includes(form.currentSemester);
  const cgpaExpected = isCgpaExpected(form.entryType, form.currentSemester);

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

  function fail(description: string) {
    toast({ title: 'Please check your details', description, variant: 'destructive' });
  }

  /** The value of a record in the mode it was given in, null for the other. */
  function scoreOf(mode: ScoreMode, percentage: number | '', cgpa: number | '') {
    return {
      percentage: mode === 'PERCENTAGE' && percentage !== '' ? Number(percentage) : null,
      cgpa: mode === 'CGPA' && cgpa !== '' ? Number(cgpa) : null,
    };
  }

  function handleSave() {
    const tenth = scoreOf(form.tenthMode, form.tenthPercentage, form.tenthCgpa);
    const twelfth = scoreOf(form.twelfthMode, form.twelfthPercentage, form.twelfthCgpa);
    const diploma = scoreOf(form.diplomaMode, form.diplomaPercentage, form.diplomaCgpa);
    const preCollege = isDiploma ? diploma : twelfth;
    const missing = (score: { percentage: number | null; cgpa: number | null }) =>
      score.percentage === null && score.cgpa === null;

    if (missing(tenth) || missing(preCollege)) {
      fail(
        isDiploma
          ? 'Your 10th and diploma scores are required (as a percentage or CGPA).'
          : 'Your 10th and 12th scores are required (as a percentage or CGPA).'
      );
      return;
    }

    if (semesterIsStale) {
      fail(
        `Choose your current semester for ${currentAcademicYearLabel()} — your batch is in semester ${allowedSemesters.join(' or ')}.`
      );
      return;
    }

    if (cgpaExpected && form.currentCGPA === '') {
      fail('Your current CGPA is required once you have a semester result.');
      return;
    }

    const marksToSave = validRows
      .filter((row) => row.sgpa !== '')
      .map((row) => ({
        semester: row.semester,
        sgpa: Number(row.sgpa),
        gradeCardUrl: row.gradeCardUrl,
      }));

    const inconsistency = cgpaConsistencyProblem(
      form.entryType,
      form.currentSemester,
      cgpaExpected && form.currentCGPA !== '' ? Number(form.currentCGPA) : null,
      marksToSave
    );
    if (inconsistency) {
      fail(inconsistency);
      return;
    }

    startTransition(async () => {
      const academicResult = await updateAcademicInfo({
        tenthPercentage: tenth.percentage,
        tenthCgpa: tenth.cgpa,
        tenthBoard: form.tenthBoard.trim() || undefined,
        tenthYear: form.tenthYear === '' ? undefined : Number(form.tenthYear),
        tenthMarksheetUrl: form.tenthMarksheetUrl,
        entryType: form.entryType,
        // Only the branch matching the entry type is sent; the server clears
        // the other one.
        twelfthPercentage: isDiploma ? null : twelfth.percentage,
        twelfthCgpa: isDiploma ? null : twelfth.cgpa,
        twelfthBoard: isDiploma
          ? undefined
          : form.twelfthBoard.trim() || undefined,
        twelfthYear:
          isDiploma || form.twelfthYear === ''
            ? undefined
            : Number(form.twelfthYear),
        twelfthMarksheetUrl: isDiploma ? null : form.twelfthMarksheetUrl,
        diplomaPercentage: isDiploma ? diploma.percentage : null,
        diplomaCgpa: isDiploma ? diploma.cgpa : null,
        diplomaBoard: isDiploma
          ? form.diplomaBoard.trim() || undefined
          : undefined,
        diplomaYear:
          !isDiploma || form.diplomaYear === ''
            ? undefined
            : Number(form.diplomaYear),
        diplomaMarksheetUrl: isDiploma ? form.diplomaMarksheetUrl : null,
        // No finished semester, no CGPA.
        currentCGPA:
          cgpaExpected && form.currentCGPA !== '' ? Number(form.currentCGPA) : null,
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

      // Only finished semesters: a row for one not over yet is dropped here
      // (and so removed from the record), as the form warned.
      const semesterResult = await updateSemesterMarks({
        entryType: form.entryType,
        marks: marksToSave,
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

      setSemesterRows(validRows);
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
        Entry type is chosen at registration and fixed thereafter. It decides
        which pre-college record is asked for below and which semesters exist,
        so letting it change here would silently discard whichever branch the
        student had already filled in.
      */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>How you entered this degree</label>
          <input type="text" value={ENTRY_TYPE_LABELS[form.entryType]} readOnly />
          <p className="panel-hint" style={{ marginTop: 8 }}>
            <Info size={12} aria-hidden />
            {isDiploma
              ? 'Lateral entry: submit your diploma instead of 12th, and record marks from semester 3 onwards. Contact your department admin if this is wrong.'
              : 'Regular entry: submit your 12th record and record marks from semester 1 onwards. Contact your department admin if this is wrong.'}
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

          <ScoreField
            label="Score"
            mode={form.tenthMode}
            onModeChange={(tenthMode) => setForm({ ...form, tenthMode })}
            percentage={form.tenthPercentage}
            cgpa={form.tenthCgpa}
            onPercentageChange={(tenthPercentage) => setForm({ ...form, tenthPercentage })}
            onCgpaChange={(tenthCgpa) => setForm({ ...form, tenthCgpa })}
          />

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
                max={new Date().getFullYear()}
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

            <ScoreField
              label="Score"
              mode={form.diplomaMode}
              onModeChange={(diplomaMode) => setForm({ ...form, diplomaMode })}
              percentage={form.diplomaPercentage}
              cgpa={form.diplomaCgpa}
              onPercentageChange={(diplomaPercentage) => setForm({ ...form, diplomaPercentage })}
              onCgpaChange={(diplomaCgpa) => setForm({ ...form, diplomaCgpa })}
            />

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
                  max={new Date().getFullYear()}
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

            <ScoreField
              label="Score"
              mode={form.twelfthMode}
              onModeChange={(twelfthMode) => setForm({ ...form, twelfthMode })}
              percentage={form.twelfthPercentage}
              cgpa={form.twelfthCgpa}
              onPercentageChange={(twelfthPercentage) => setForm({ ...form, twelfthPercentage })}
              onCgpaChange={(twelfthCgpa) => setForm({ ...form, twelfthCgpa })}
            />

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
                  max={new Date().getFullYear()}
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
            <label>Current Cumulative CGPA{cgpaExpected ? ' *' : ''}</label>
            {/* No semester finished yet, so no CGPA exists to enter. */}
            <input
              type="number"
              min={0}
              max={10}
              step="0.01"
              disabled={!cgpaExpected}
              placeholder={cgpaExpected ? '' : 'Not yet — no semester finished'}
              value={cgpaExpected ? form.currentCGPA : ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  currentCGPA:
                    e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />
            {!cgpaExpected && (
              <p className="field-hint">
                You will add this once your {ordinalSemester(firstSemester)} results are out.
              </p>
            )}
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Current Semester *</label>
            <select
              value={form.currentSemester}
              onChange={(e) =>
                setForm({ ...form, currentSemester: Number(e.target.value) })
              }
            >
              {semesterIsStale && (
                <option value={form.currentSemester} disabled>
                  {ordinalSemester(form.currentSemester)} — from last year, please update
                </option>
              )}
              {allowedSemesters.map((sem) => (
                <option key={sem} value={sem}>
                  {ordinalSemester(sem)}
                </option>
              ))}
            </select>
            <p
              className="field-hint"
              style={semesterIsStale ? { color: 'var(--red)' } : undefined}
            >
              {semesterIsStale
                ? `Your semester on record is from last year. For ${currentAcademicYearLabel()} your batch is in semester ${allowedSemesters.join(' or ')}.`
                : `For ${currentAcademicYearLabel()} your batch is in semester ${allowedSemesters.join(' or ')}.`}
            </p>
          </div>
        </div>
      </div>

      {/* Semester grade breakdown */}
      <div className="panel panel-plain" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <strong className="panel-title">Semester Grade Breakdown</strong>
          <span className="badge badge-accent">
            {validRows.length} of {selectableSemesters.length} recorded
          </span>
        </div>

        <p className="panel-hint">
          <Info size={12} aria-hidden />
          {selectableSemesters.length === 0
            ? `No semester has finished yet — you can add results once your ${ordinalSemester(firstSemester)} is over.`
            : `You can add results for semester ${firstSemester} to ${maxAllowedSem} — the ones already finished (you are in your ${ordinalSemester(form.currentSemester)}).`}
          {isDiploma &&
            ' Semesters 1 and 2 do not apply to a lateral-entry student.'}
        </p>

        {semesterRows.length > 0 && (
          <div className="semester-grid">
            {semesterRows.map((row, index) => {
              const notFinished = !selectableSemesters.includes(row.semester);
              return (
              <div
                key={row.semester}
                className="semester-card"
                style={notFinished ? { opacity: 0.6, borderColor: 'var(--red)' } : undefined}
              >
                {notFinished && (
                  <p className="field-hint" style={{ color: 'var(--red)', marginTop: 0 }}>
                    Semester {row.semester} is not finished yet, so this result
                    will be removed when you save.
                  </p>
                )}
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
              );
            })}
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
