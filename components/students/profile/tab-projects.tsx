'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/ui/date-picker';
import TagInput from '@/components/ui/tag-input';
import UrlField from '@/components/ui/url-field';
import { useToast } from '@/hooks/use-toast';
import {
  addProject,
  updateProject,
  removeProject,
} from '@/features/students/actions/profile-projects';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';
import type { StudentProject } from '@prisma/client';

export interface TabProjectsProps {
  profile: CompleteProfile;
}

interface ProjectForm {
  title: string;
  description: string;
  technologies: string[];
  projectUrl: string;
  startDate: Date | null;
  endDate: Date | null;
}

const EMPTY_FORM: ProjectForm = {
  title: '',
  description: '',
  technologies: [],
  projectUrl: '',
  startDate: null,
  endDate: null,
};

export default function TabProjects({ profile }: TabProjectsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);

  function startEdit(project: StudentProject) {
    setEditingId(project.id);
    setForm({
      title: project.title,
      description: project.description,
      technologies: project.technologiesUsed
        ? project.technologiesUsed.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      projectUrl: project.projectUrl ?? '',
      startDate: project.startDate ? new Date(project.startDate) : null,
      endDate: project.endDate ? new Date(project.endDate) : null,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.title || !form.description || form.technologies.length === 0) {
      toast({
        title: 'Validation error',
        description: 'Title, description, and technologies are required.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const payload = {
        title: form.title,
        description: form.description,
        technologiesUsed: form.technologies.join(', '),
        projectUrl: form.projectUrl || undefined,
        startDate: form.startDate
          ? form.startDate.toISOString().split('T')[0]
          : undefined,
        endDate: form.endDate
          ? form.endDate.toISOString().split('T')[0]
          : undefined,
      };

      const result = editingId
        ? await updateProject(editingId, payload)
        : await addProject(payload);

      if (result.success) {
        toast({
          title: 'Saved',
          description: editingId ? 'Project updated.' : 'Project added.',
        });
        resetForm();
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to save project.',
          variant: 'destructive',
        });
      }
    });
  }

  function handleDelete(projectId: string) {
    startTransition(async () => {
      const result = await removeProject(projectId);
      if (result.success) {
        toast({ title: 'Deleted', description: 'Project removed.' });
        if (editingId === projectId) resetForm();
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Failed to delete project.',
          variant: 'destructive',
        });
      }
    });
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Projects
      </h3>

      {profile.projects.map((project) => (
        <div key={project.id} className="card" style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <strong>{project.title}</strong>
              <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
                {project.description}
              </p>
              {project.projectUrl && (
                <a
                  href={project.projectUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: 'var(--accent-dark)' }}
                >
                  View project →
                </a>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => startEdit(project)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleDelete(project.id)}
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
          {editingId ? 'Edit Project' : 'Add Project'}
        </h4>
        <div className="field">
          <label>Title *</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
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
        <div className="field">
          <label>Technologies *</label>
          <TagInput
            value={form.technologies}
            onChange={(technologies) => setForm({ ...form, technologies })}
            placeholder="React, Node.js…"
          />
        </div>
        <div className="field">
          <label>Project URL</label>
          <UrlField
            platform="url"
            value={form.projectUrl}
            onChange={(projectUrl) => setForm({ ...form, projectUrl })}
            placeholder="project-demo.com"
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Start Date</label>
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
            {isPending ? 'Saving…' : editingId ? 'Update project' : 'Add project'}
          </button>
        </div>
      </div>
    </div>
  );
}
