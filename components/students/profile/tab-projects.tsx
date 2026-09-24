'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import UrlField from '@/components/ui/url-field';
import { useToast } from '@/hooks/use-toast';
import { syncProjects } from '@/features/students/actions/profile-sync-collections';
import { useRegisterProfileSave } from './profile-save-context';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabProjectsProps {
  profile: CompleteProfile;
}

interface ProjectRow {
  /** Null for a row the student just added and has not saved yet. */
  id: string | null;
  title: string;
  techStack: string;
  description: string;
  projectUrl: string;
}

const EMPTY_ROW: ProjectRow = {
  id: null,
  title: '',
  techStack: '',
  description: '',
  projectUrl: '',
};

export default function TabProjects({ profile }: TabProjectsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<ProjectRow[]>(() =>
    profile.projects.map((project) => ({
      id: project.id,
      title: project.title,
      techStack: project.technologiesUsed,
      description: project.description,
      projectUrl: project.projectUrl ?? '',
    }))
  );

  function updateRow(index: number, patch: Partial<ProjectRow>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleSave() {
    const incomplete = rows.find(
      (row) => !row.title.trim() || !row.techStack.trim() || !row.description.trim()
    );

    if (incomplete) {
      toast({
        title: 'Validation error',
        description:
          'Every project needs a title, tech stack, and description.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await syncProjects({
        projects: rows.map((row) => ({
          id: row.id,
          title: row.title.trim(),
          technologiesUsed: row.techStack.trim(),
          description: row.description.trim(),
          projectUrl: row.projectUrl.trim() || undefined,
        })),
      });

      if (result.success) {
        toast({ title: 'Saved', description: 'Projects updated.' });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save projects.',
          variant: 'destructive',
        });
      }
    });
  }

  useRegisterProfileSave(handleSave, isPending);

  return (
    <div>
      <div className="tab-head">
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>
            Key Projects &amp; Technical Work
          </h3>
          <p className="tab-subtitle">
            Highlight your best applications, GitHub repositories, or research
            prototypes.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
        >
          + Add another project
        </button>
      </div>

      {rows.length === 0 && (
        <p className="tab-empty">
          No projects added yet. Use “Add another project” to create your first
          entry.
        </p>
      )}

      {rows.map((row, index) => (
        <div key={row.id ?? `new-${index}`} className="entry-card">
          <div className="entry-head">
            <span className="entry-index">#{index + 1}</span>
            <strong className="entry-title">
              {row.title.trim() || 'Untitled project'}
            </strong>
            <button
              type="button"
              className="entry-remove"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              aria-label={`Remove project ${index + 1}`}
              title="Remove this project"
            >
              ×
            </button>
          </div>

          <div className="entry-body">
            <div className="field-row">
              <div className="field">
                <label>Project Title *</label>
                <input
                  value={row.title}
                  onChange={(e) => updateRow(index, { title: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Tech Stack *</label>
                <input
                  value={row.techStack}
                  placeholder="React, Node.js, MongoDB, Express"
                  onChange={(e) =>
                    updateRow(index, { techStack: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="field">
              <label>Description *</label>
              <textarea
                rows={2}
                value={row.description}
                onChange={(e) =>
                  updateRow(index, { description: e.target.value })
                }
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>Project / GitHub Link (optional)</label>
              <UrlField
                platform="url"
                value={row.projectUrl}
                onChange={(projectUrl) => updateRow(index, { projectUrl })}
                placeholder="github.com/username/project"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="tab-footer tab-footer-split">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setRows([...rows, { ...EMPTY_ROW }])}
        >
          + Add another project
        </button>
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
