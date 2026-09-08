'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import TagInput from '@/components/ui/tag-input';
import { useToast } from '@/hooks/use-toast';
import { updatePreferences } from '@/features/students/actions/profile-preferences';
import { parseJsonArray } from '@/lib/parse-json-array';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabPreferencesProps {
  profile: CompleteProfile;
}

const COMPANY_TYPES = ['Product', 'Service', 'Startup', 'PSU', 'Consulting'];

export default function TabPreferences({ profile }: TabPreferencesProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    preferredRoles: parseJsonArray(profile.preferences?.preferredRoles),
    preferredLocations: parseJsonArray(profile.preferences?.preferredLocations),
    preferredCompanyTypes: parseJsonArray(
      profile.preferences?.preferredCompanyTypes
    ),
    expectedPackageMin: profile.preferences?.expectedPackageMin ?? ('' as number | ''),
    expectedPackageMax: profile.preferences?.expectedPackageMax ?? ('' as number | ''),
    willingToRelocate: profile.preferences?.willingToRelocate ?? false,
  });

  function toggleCompanyType(type: string) {
    setForm((prev) => {
      const exists = prev.preferredCompanyTypes.includes(type);
      return {
        ...prev,
        preferredCompanyTypes: exists
          ? prev.preferredCompanyTypes.filter((item) => item !== type)
          : [...prev.preferredCompanyTypes, type],
      };
    });
  }

  function handleSave() {
    if (
      form.preferredRoles.length === 0 ||
      form.preferredLocations.length === 0 ||
      form.preferredCompanyTypes.length === 0
    ) {
      toast({
        title: 'Validation error',
        description: 'Please add roles, locations, and company types.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await updatePreferences({
        preferredRoles: form.preferredRoles,
        preferredLocations: form.preferredLocations,
        preferredCompanyTypes: form.preferredCompanyTypes,
        willingToRelocate: form.willingToRelocate,
        expectedPackageMin:
          form.expectedPackageMin === ''
            ? undefined
            : Number(form.expectedPackageMin),
        expectedPackageMax:
          form.expectedPackageMax === ''
            ? undefined
            : Number(form.expectedPackageMax),
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

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Job Preferences
      </h3>

      <div className="field">
        <label>Preferred Roles *</label>
        <TagInput
          value={form.preferredRoles}
          onChange={(preferredRoles) =>
            setForm({ ...form, preferredRoles })
          }
          placeholder="Software Engineer, Data Analyst…"
        />
      </div>

      <div className="field">
        <label>Preferred Locations *</label>
        <TagInput
          value={form.preferredLocations}
          onChange={(preferredLocations) =>
            setForm({ ...form, preferredLocations })
          }
          placeholder="Bangalore, Remote…"
        />
      </div>

      <div className="field">
        <label>Preferred Company Types *</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {COMPANY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`filter-pill ${form.preferredCompanyTypes.includes(type) ? 'active' : ''}`}
              onClick={() => toggleCompanyType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="pref-row">
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Willing to Relocate</div>
        </div>
        <button
          type="button"
          className={`toggle-switch ${form.willingToRelocate ? 'on' : ''}`}
          onClick={() =>
            setForm({
              ...form,
              willingToRelocate: !form.willingToRelocate,
            })
          }
          aria-label="Toggle relocation preference"
        >
          <span className="knob" />
        </button>
      </div>

      <div className="field-row" style={{ marginTop: 16 }}>
        <div className="field">
          <label>Expected Package Min (LPA)</label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={form.expectedPackageMin}
            onChange={(e) =>
              setForm({
                ...form,
                expectedPackageMin:
                  e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="field">
          <label>Expected Package Max (LPA)</label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={form.expectedPackageMax}
            onChange={(e) =>
              setForm({
                ...form,
                expectedPackageMax:
                  e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
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
