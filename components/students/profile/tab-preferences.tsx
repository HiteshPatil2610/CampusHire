'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import TagInput from '@/components/ui/tag-input';
import { useToast } from '@/hooks/use-toast';
import { updatePreferences } from '@/features/students/actions/profile-preferences';
import { parseJsonArray } from '@/lib/parse-json-array';
import { useRegisterProfileSave } from './profile-save-context';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabPreferencesProps {
  profile: CompleteProfile;
}

const COMPANY_TYPES = ['Product', 'Service', 'Startup', 'PSU', 'Consulting'];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid'] as const;

type WorkMode = (typeof WORK_MODES)[number];

export default function TabPreferences({ profile }: TabPreferencesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState(() => ({
    preferredRoles: parseJsonArray(profile.preferences?.preferredRoles),
    preferredLocations: parseJsonArray(profile.preferences?.preferredLocations),
    // Stored as an array for compatibility, but the form offers a single type.
    companyType:
      parseJsonArray(profile.preferences?.preferredCompanyTypes)[0] ??
      COMPANY_TYPES[0],
    willingToRelocate: profile.preferences?.willingToRelocate ?? false,
    workModes: parseJsonArray(profile.preferences?.workModes).filter(
      (mode): mode is WorkMode => WORK_MODES.includes(mode as WorkMode)
    ),
  }));

  function toggleWorkMode(mode: WorkMode) {
    setForm((previous) => ({
      ...previous,
      workModes: previous.workModes.includes(mode)
        ? previous.workModes.filter((value) => value !== mode)
        : [...previous.workModes, mode],
    }));
  }

  function handleSave() {
    if (
      form.preferredRoles.length === 0 ||
      form.preferredLocations.length === 0
    ) {
      toast({
        title: 'Validation error',
        description: 'Add at least one target role and one preferred location.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await updatePreferences({
        preferredRoles: form.preferredRoles,
        preferredLocations: form.preferredLocations,
        preferredCompanyTypes: [form.companyType],
        workModes: form.workModes,
        willingToRelocate: form.willingToRelocate,
      });

      if (result.success) {
        toast({ title: 'Saved', description: 'Preferences updated.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save preferences.',
          variant: 'destructive',
        });
      }
    });
  }

  useRegisterProfileSave(handleSave, isPending);

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 18 }}>
        Job Preferences &amp; Career Aspirations
      </h3>

      <div className="field">
        <div className="field-label-row">
          <label>Target Job Roles &amp; Designations</label>
          <span className="field-hint-inline">
            Press Enter or comma (,) to add tags
          </span>
        </div>
        <TagInput
          value={form.preferredRoles}
          onChange={(preferredRoles) => setForm({ ...form, preferredRoles })}
          placeholder="e.g. DevOps Engineer, ML Engineer…"
        />
      </div>

      <div className="field">
        <div className="field-label-row">
          <label>Preferred Job Locations &amp; Cities</label>
          <span className="field-hint-inline">
            Press Enter or comma (,) to add tags
          </span>
        </div>
        <TagInput
          value={form.preferredLocations}
          onChange={(preferredLocations) =>
            setForm({ ...form, preferredLocations })
          }
          placeholder="e.g. Mumbai, Delhi NCR, Chennai…"
        />
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Preferred Company Type</label>
            <select
              value={form.companyType}
              onChange={(e) =>
                setForm({ ...form, companyType: e.target.value })
              }
            >
              {COMPANY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Willing to Relocate</label>
            <select
              value={form.willingToRelocate ? 'yes' : 'no'}
              onChange={(e) =>
                setForm({
                  ...form,
                  willingToRelocate: e.target.value === 'yes',
                })
              }
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <strong className="panel-title">Work Mode Preferences</strong>
        </div>
        <div className="checkbox-row">
          {WORK_MODES.map((mode) => (
            <label key={mode} className="checkbox-option">
              <input
                type="checkbox"
                checked={form.workModes.includes(mode)}
                onChange={() => toggleWorkMode(mode)}
              />
              <span>{mode}</span>
            </label>
          ))}
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
