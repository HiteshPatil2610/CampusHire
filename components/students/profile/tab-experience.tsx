'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import {
  addExperience,
  updateExperience,
  removeExperience,
} from '@/features/students/actions/profile-experience';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';
import type { StudentExperience } from '@prisma/client';

export interface TabExperienceProps {
  profile: CompleteProfile;
}

interface ExperienceForm {
  companyName: string;
  role: string;
  description: string;
  startDate: Date | null;
  endDate: Date | null;
}

const EMPTY_FORM: ExperienceForm = {
  companyName: '',
  role: '',
  description: '',
  startDate: null,
  endDate: null,
};

export default function TabExperience({ profile }: TabExperienceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExperienceForm>(EMPTY_FORM);

  function startEdit(experience: StudentExperience) {
    setEditingId(experience.id);
    setForm({
      companyName: experience.companyName,
      role: experience.role,
      description: experience.description,
      startDate: new Date(experience.startDate),
      endDate: experience.endDate ? new Date(experience.endDate) : null,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.companyName || !form.role || !form.description || !form.startDate) {
      toast({
        title: 'Validation error',
        description: 'Company, role, description, and start date are required.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const payload = {
        companyName: form.companyName,
        role: form.role,
        description: form.description,
        startDate: form.startDate!.toISOString().split('T')[0],
        endDate: form.endDate
          ? form.endDate.toISOString().split('T')[0]
          : undefined,
      };

      const result = editingId
        ? await updateExperience(editingId, payload)
        : await addExperience(payload);

      if (result.success) {
        toast({
          title: 'Saved',
          description: editingId ? 'Experience updated.' : 'Experience added.',
        });
        resetForm();
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save experience.',
          variant: 'destructive',
        });
      }
    });
  }

  function handleDelete(experienceId: string) {
    startTransition(async () => {
      const result = await removeExperience(experienceId);
      if (result.success) {
        toast({ title: 'Deleted', description: 'Experience removed.' });
        if (editingId === experienceId) resetForm();
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to delete experience.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Internships & Experience
      </h3>

      {profile.experiences.map((experience) => (
        <div key={experience.id} className="card" style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <strong>{experience.role}</strong>
              <div className="text-secondary" style={{ fontSize: 13 }}>
                {experience.companyName}
              </div>
              <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
                {experience.description}
              </p>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {new Date(experience.startDate).toLocaleDateString()} —{' '}
                {experience.endDate
                  ? new Date(experience.endDate).toLocaleDateString()
                  : 'Present'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => startEdit(experience)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleDelete(experience.id)}
                disabled={isPending}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="card" style={{ background: 'var(--surface-1)' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>
          {editingId ? 'Edit Experience' : 'Add Experience'}
        </h4>
        <div className="field-row">
          <div className="field">
            <label>Company *</label>
            <input
              value={form.companyName}
              onChange={(e) =>
                setForm({ ...form, companyName: e.target.value })
              }
            />
          </div>
          <div className="field">
            <label>Role *</label>
            <input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Description *</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Start Date *</label>
            <DatePicker
              value={form.startDate}
              onChange={(startDate) => setForm({ ...form, startDate })}
            />
          </div>
          <div className="field">
            <label>End Date</label>
            <DatePicker
              value={form.endDate}
              onChange={(endDate) => setForm({ ...form, endDate })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editingId && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending
              ? 'Saving…'
              : editingId
                ? 'Update experience'
                : 'Add experience'}
          </button>
        </div>
      </div>
    </div>
  );
}
