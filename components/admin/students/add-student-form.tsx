'use client';

import { useState, useTransition, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  addStudentManual,
  type AddStudentManualInput,
} from '@/features/students/actions/add-student-manual';

interface AddStudentFormProps {
  departmentCode: string;
  departmentId: string; // For display only - server uses requireDepartmentAdmin()
}

/**
 * Add Student Form (Client Component)
 * 
 * Manual student enrollment form with locked department field.
 * Department is read-only - taken from admin's context server-side.
 */
export function AddStudentForm({
  departmentCode,
  departmentId,
}: AddStudentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: '',
    rollNumber: '',
    email: '',
    phoneNumber: '',
    batchYear: '',
  });

  function handleChange(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Basic client-side validation
    if (!form.name.trim() || !form.rollNumber.trim() || !form.email.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in Name, Roll Number, and Email.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const input: AddStudentManualInput = {
        name: form.name.trim(),
        rollNumber: form.rollNumber.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim() || undefined,
        batchYear: form.batchYear ? parseInt(form.batchYear, 10) : undefined,
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

      {/* Roll Number and Batch Year */}
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
          <label>Batch Year</label>
          <input
            type="number"
            min="2000"
            max="2100"
            value={form.batchYear}
            onChange={(e) => handleChange('batchYear', e.target.value)}
            placeholder="e.g. 2026"
            disabled={isPending}
          />
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
          <label>Phone Number</label>
          <input
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
