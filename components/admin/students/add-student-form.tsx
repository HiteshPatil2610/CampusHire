'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  addStudentManual,
  type AddStudentManualInput,
} from '@/features/students/actions/add-student-manual';
import { batchLabel, selectablePassoutYears } from '@/features/students/utils/batch';

interface AddStudentFormProps {
  departmentCode: string;
  /** The department's default batch (DepartmentSettings), prefilled. */
  defaultPassoutYear: number | null;
}

/**
 * Add Student Form (Client Component)
 * 
 * Manual student enrollment form with locked department field.
 * Department is read-only - taken from admin's context server-side.
 */
export function AddStudentForm({
  departmentCode,
  defaultPassoutYear,
}: AddStudentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    misNumber: '',
    prnNumber: '',
    name: '',
    rollNumber: '',
    email: '',
    phoneNumber: '',
    expectedPassoutYear: defaultPassoutYear ? String(defaultPassoutYear) : '',
  });

  // The default batch stays choosable even when it falls outside the usual
  // window of years.
  const passoutYears = [
    ...new Set([
      ...selectablePassoutYears(),
      ...(defaultPassoutYear ? [defaultPassoutYear] : []),
    ]),
  ].sort((a, b) => a - b);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Basic client-side validation
    if (
      !form.misNumber.trim() ||
      !form.name.trim() ||
      !form.rollNumber.trim() ||
      !form.email.trim() ||
      !form.phoneNumber.trim() ||
      !form.expectedPassoutYear
    ) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in MIS No., Name, Roll No., Email, Phone and Batch.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const input: AddStudentManualInput = {
        misNumber: form.misNumber,
        prnNumber: form.prnNumber.trim() || undefined,
        name: form.name,
        rollNumber: form.rollNumber,
        email: form.email,
        phoneNumber: form.phoneNumber,
        expectedPassoutYear: Number(form.expectedPassoutYear),
      };

      const result = await addStudentManual(input);

      if (result.success) {
        toast({
          title: 'Student Enrolled',
          description: `${form.name} has been added to the ${departmentCode} roster.`,
        });
        router.push('/admin-dashboard/students');
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <form
      className="card"
      style={{ maxWidth: 520 }}
      onSubmit={handleSubmit}
    >
      {/* Full Name */}
      <div className="field">
        <label>Full Name *</label>
        <input
          required
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g. Aditi Sharma"
          disabled={isPending}
        />
      </div>

      {/* MIS and PRN */}
      <div className="field-row">
        <div className="field">
          <label>MIS No. *</label>
          <input
            required
            value={form.misNumber}
            onChange={(e) => handleChange('misNumber', e.target.value.toUpperCase())}
            placeholder="e.g. MIS2023001"
            disabled={isPending}
          />
        </div>
        <div className="field">
          <label>PRN No.</label>
          <input
            value={form.prnNumber}
            onChange={(e) => handleChange('prnNumber', e.target.value.toUpperCase())}
            placeholder="Optional"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Roll Number and Batch */}
      <div className="field-row">
        <div className="field">
          <label>Roll Number *</label>
          <input
            required
            value={form.rollNumber}
            onChange={(e) => handleChange('rollNumber', e.target.value)}
            placeholder="e.g. 21CS042"
            disabled={isPending}
          />
        </div>
        <div className="field">
          <label>Batch *</label>
          <select
            required
            value={form.expectedPassoutYear}
            onChange={(e) => handleChange('expectedPassoutYear', e.target.value)}
            disabled={isPending}
          >
            <option value="">Select batch</option>
            {passoutYears.map((year) => (
              <option key={year} value={year}>
                {batchLabel(year)} (passout {year})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* College Email and Phone */}
      <div className="field-row">
        <div className="field">
          <label>College Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="student@college.edu"
            disabled={isPending}
          />
        </div>
        <div className="field">
          <label>Phone Number *</label>
          <input
            required
            type="tel"
            value={form.phoneNumber}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            placeholder="+91 98765 43210"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Department (Locked) */}
      <div className="field">
        <label>Department (Locked)</label>
        <div
          className="locked-email-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface-hover)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            🏛️ {departmentCode}
          </span>
          <span
            className="le-badge"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--amber-surface)',
              color: 'var(--amber)',
              fontWeight: 600,
            }}
          >
            🔒 Auto-assigned
          </span>
        </div>
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginTop: 4,
          }}
        >
          Students are automatically assigned to your department. Department
          cannot be changed.
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => router.push('/admin-dashboard/students')}
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
        >
          {isPending ? 'Enrolling...' : 'Enroll Student'}
        </button>
      </div>
    </form>
  );
}
