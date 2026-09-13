import { useRef, useEffect } from 'react';
import UrlField from '../../ui/UrlField';
import Button from '../../ui/Button';

export function isProjectComplete(p) {
  return Boolean(
    p &&
    String(p.title || '').trim() &&
    String(p.description || '').trim() &&
    String(p.tech || '').trim() &&
    String(p.link || '').trim()
  );
}

export default function TabProjects({ form, setField, onSave, showToast }) {
  const projects = form.projects || [];
  const listEndRef = useRef(null);
  const prevCountRef = useRef(projects.length);

  const hasIncompleteProjects = projects.some((p) => !isProjectComplete(p));

  // Automatically scroll down when a project is added
  useEffect(() => {
    if (projects.length > prevCountRef.current) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevCountRef.current = projects.length;
  }, [projects.length]);

  function handleUpdateProject(index, field, value) {
    const updated = [...projects];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setField('projects', updated);
  }

  function handleRemoveProject(index) {
    if (projects.length <= 1) {
      showToast('You must keep at least one project entry.', 'warning');
      return;
    }
    const updated = projects.filter((_, i) => i !== index);
    setField('projects', updated);
    showToast('Project removed.', 'info');
  }

  function handleAddProject() {
    if (hasIncompleteProjects) {
      showToast('Please complete all fields in your existing projects before adding another.', 'error');
      return;
    }

    const newProject = {
      id: Date.now(),
      title: '',
      description: '',
      tech: '',
      link: '',
    };
    setField('projects', [...projects, newProject]);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>
            Key Projects & Technical Work
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Highlight your best applications, GitHub repositories, or research prototypes.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={hasIncompleteProjects}
          title={hasIncompleteProjects ? 'Fill all fields in existing projects first' : 'Add another project'}
          onClick={handleAddProject}
        >
          + Add another project
        </Button>
      </div>

      {hasIncompleteProjects && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            background: 'var(--amber-light)',
            color: 'var(--amber)',
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 16,
            border: '0.5px solid var(--amber)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠</span>
          <span>Fill all fields in incomplete project cards to save changes or add another project.</span>
        </div>
      )}

      {/* Project Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {projects.map((proj, idx) => {
          const complete = isProjectComplete(proj);
          const isTitleMissing = !String(proj.title || '').trim();
          const isDescMissing = !String(proj.description || '').trim();
          const isTechMissing = !String(proj.tech || '').trim();
          const isLinkMissing = !String(proj.link || '').trim();

          return (
            <div
              key={proj.id || idx}
              className="card"
              style={{
                background: complete ? 'var(--surface-1)' : 'var(--amber-light)',
                border: complete ? '0.5px solid var(--border)' : '1.5px solid var(--amber)',
                padding: 16,
                borderRadius: 'var(--radius-lg)',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: complete ? 'var(--surface-2)' : 'var(--surface-2)',
                      color: complete ? 'var(--text-primary)' : 'var(--amber)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {proj.title || `Project #${idx + 1} (Untitled)`}
                  </strong>
                </div>

                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 18,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    lineHeight: 1,
                    padding: '2px 6px',
                  }}
                  title="Remove project"
                  onClick={() => handleRemoveProject(idx)}
                >
                  ×
                </button>
              </div>

              {!complete && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--amber)',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>⚠</span> Fill all fields to save or add another project
                </div>
              )}

              {/* Title & Tech */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                <div className="field">
                  <label style={{ fontSize: 12, color: isTitleMissing ? 'var(--amber)' : undefined }}>
                    Project Title * {isTitleMissing && '(Required)'}
                  </label>
                  <input
                    type="text"
                    value={proj.title || ''}
                    onChange={(e) => handleUpdateProject(idx, 'title', e.target.value)}
                    placeholder="e.g. Campus Event Scheduler"
                    style={{
                      borderColor: isTitleMissing ? 'var(--amber)' : undefined,
                      background: 'var(--surface-2)',
                    }}
                  />
                </div>

                <div className="field">
                  <label style={{ fontSize: 12, color: isTechMissing ? 'var(--amber)' : undefined }}>
                    Tech Stack * {isTechMissing && '(Required)'}
                  </label>
                  <input
                    type="text"
                    value={proj.tech || ''}
                    onChange={(e) => handleUpdateProject(idx, 'tech', e.target.value)}
                    placeholder="e.g. React, Node.js, MongoDB, Express"
                    style={{
                      borderColor: isTechMissing ? 'var(--amber)' : undefined,
                      background: 'var(--surface-2)',
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="field" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: isDescMissing ? 'var(--amber)' : undefined }}>
                  Description * {isDescMissing && '(Required)'}
                </label>
                <textarea
                  rows={2}
                  value={proj.description || ''}
                  onChange={(e) => handleUpdateProject(idx, 'description', e.target.value)}
                  placeholder="Describe the problem solved, architecture, and personal contributions…"
                  style={{
                    borderColor: isDescMissing ? 'var(--amber)' : undefined,
                    background: 'var(--surface-2)',
                  }}
                />
              </div>

              {/* Project Link */}
              <div className="field">
                <label style={{ fontSize: 12, color: isLinkMissing ? 'var(--amber)' : undefined }}>
                  Project / GitHub Link * {isLinkMissing && '(Required)'}
                </label>
                <UrlField
                  prefix="https://"
                  value={(proj.link || '').replace(/^https?:\/\//i, '')}
                  onChange={(val) => handleUpdateProject(idx, 'link', val)}
                  placeholder="github.com/username/project-repo"
                />
              </div>
            </div>
          );
        })}

        <div ref={listEndRef} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={hasIncompleteProjects}
          onClick={handleAddProject}
        >
          + Add another project
        </Button>

        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
