'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { updateAcademicInfo } from '@/features/students/actions/profile-academic';
import { updateSemesterMarks } from '@/features/students/actions/profile-semester-marks';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabAcademicInfoProps {
  profile: CompleteProfile;
}

interface SemesterRow {
  semester: number;
  sgpa: number | '';
}

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function TabAcademicInfo({ profile }: TabAcademicInfoProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isSavingSemesters, startSemesterTransition] = useTransition();

  const [form, setForm] = useState({
    tenthPercentage: profile.academic?.tenthPercentage ?? ('' as number | ''),
    twelfthPercentage: profile.academic?.twelfthPercentage ?? ('' as number | ''),
    currentCGPA: profile.academic?.currentCGPA ?? ('' as number | ''),
    currentSemester: profile.academic?.currentSemester ?? 1,
    activeBacklogs: profile.academic?.activeBacklogs ?? 0,
  });

  const [semesterRows, setSemesterRows] = useState<SemesterRow[]>(() =>
    profile.semesterMarks.map((mark) => ({
      semester: mark.semester,
      sgpa: mark.sgpa,
    }))
  );

  const maxAllowedSem = Math.max(0, form.currentSemester - 1);

  function handleAddSemester() {
    if (semesterRows.length >= maxAllowedSem) {
      toast({
        title: 'Limit reached',
        description: `You can add results up to semester ${maxAllowedSem}.`,
        variant: 'destructive',
      });
      return;
    }

    const used = new Set(semesterRows.map((row) => row.semester));
    const nextSemester =
      SEMESTER_OPTIONS.find((sem) => sem <= maxAllowedSem && !used.has(sem)) ??
      semesterRows.length + 1;

    if (nextSemester > maxAllowedSem) return;

    setSemesterRows([...semesterRows, { semester: nextSemester, sgpa: '' }]);
  }

  function handleSaveAcademic() {
    if (
      form.tenthPercentage === '' ||
      form.twelfthPercentage === '' ||
      form.currentCGPA === ''
    ) {
      toast({
        title: 'Validation error',
        description: 'Please fill all required academic fields.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await updateAcademicInfo({
        tenthPercentage: Number(form.tenthPercentage),
        twelfthPercentage: Number(form.twelfthPercentage),
        currentCGPA: Number(form.currentCGPA),
        currentSemester: form.currentSemester,
        activeBacklogs: form.activeBacklogs,
      });

      if (result.success) {
        toast({ title: 'Saved', description: 'Academic info updated.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save.',
          variant: 'destructive',
        });
      }
    });
  }

  function handleSaveSemesters() {
    const marks = semesterRows
      .filter((row) => row.sgpa !== '')
      .map((row) => ({
        semester: row.semester,
        sgpa: Number(row.sgpa),
      }));

    startSemesterTransition(async () => {
      const result = await updateSemesterMarks({ marks });

      if (result.success) {
        toast({ title: 'Saved', description: 'Semester results updated.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save semester results.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Academic Credentials
      </h3>

      <div className="field-row" style={{ marginBottom: 20 }}>
        <div className="card" style={{ background: 'var(--surface-1)' }}>
          <strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
            10th Secondary School
          </strong>
          <div className="field">
            <label>Percentage *</label>
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
        </div>
        <div className="card" style={{ background: 'var(--surface-1)' }}>
          <strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
            12th Higher Secondary
          </strong>
          <div className="field">
            <label>Percentage *</label>
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
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="field-row">
          <div className="field">
            <label>Current CGPA *</label>
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
          <div className="field">
            <label>Current Semester *</label>
            <select
              value={form.currentSemester}
              onChange={(e) =>
                setForm({
                  ...form,
                  currentSemester: Number(e.target.value),
                })
              }
            >
              {SEMESTER_OPTIONS.map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Active Backlogs *</label>
          <input
            type="number"
            min={0}
            value={form.activeBacklogs}
            onChange={(e) =>
              setForm({
                ...form,
                activeBacklogs: Number(e.target.value) || 0,
              })
            }
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveAcademic}
            disabled={isPending}
          >
            {isPending ? 'Saving…' : 'Save academic info'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h4 style={{ margin: 0, fontSize: 14 }}>Semester Grade Breakdown</h4>
          <span className="badge badge-accent">
            {semesterRows.length} of {maxAllowedSem} allowed
          </span>
        </div>
        <p className="text-secondary" style={{ fontSize: 12, marginBottom: 16 }}>
          Add SGPA results up to semester {maxAllowedSem} (one below your current
          semester).
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {semesterRows.map((row, index) => (
            <div
              key={`${row.semester}-${index}`}
              style={{
                background: 'var(--surface-1)',
                border: '0.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 12,
              }}
            >
              <strong style={{ fontSize: 13 }}>Semester {row.semester}</strong>
              <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>SGPA</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.01"
                  value={row.sgpa}
                  onChange={(e) => {
                    const updated = [...semesterRows];
                    updated[index] = {
                      ...row,
                      sgpa:
                        e.target.value === '' ? '' : Number(e.target.value),
                    };
                    setSemesterRows(updated);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={semesterRows.length >= maxAllowedSem}
            onClick={handleAddSemester}
          >
            + Add semester result
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveSemesters}
            disabled={isSavingSemesters}
          >
            {isSavingSemesters ? 'Saving…' : 'Save semester results'}
          </button>
        </div>
      </div>
    </div>
  );
}
