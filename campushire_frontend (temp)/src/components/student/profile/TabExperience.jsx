import { useRef } from 'react';
import DatePicker from '../../ui/DatePicker';
import Button from '../../ui/Button';

export default function TabExperience({
  form,
  setField,
  onSave,
  attachedFiles,
  setAttachedFile,
  showToast,
}) {
  const experiences = form.experience || [];
  const fileInputRefs = useRef({});

  function handleUpdateExp(index, field, value) {
    const updated = [...experiences];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setField('experience', updated);
  }

  function handleRemoveExp(index) {
    const updated = experiences.filter((_, i) => i !== index);
    setField('experience', updated);
    showToast('Experience entry removed.', 'info');
  }

  function handleAddExp() {
    const newExp = {
      id: Date.now(),
      company: '',
      role: '',
      start: '2025-06-01',
      end: '2025-08-15',
      description: '',
    };
    setField('experience', [...experiences, newExp]);
    showToast('Added new experience entry.', 'info');
  }

  function handleExpFileChange(expKey, e) {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(expKey, file.name);
      showToast(`Attached document "${file.name}" for internship experience.`, 'success');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>
            Internships & Professional Experience
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Record prior full-time, part-time, or research internships relevant to campus placements.
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleAddExp}>
          + Add experience
        </Button>
      </div>

      {experiences.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            background: 'var(--surface-1)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--border)',
            marginBottom: 20,
          }}
        >
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            No internship experiences recorded yet.
          </p>
          <Button type="button" size="sm" onClick={handleAddExp}>
            + Add first internship experience
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {experiences.map((exp, idx) => {
            const expKey = `exp-${exp.id || idx + 1}`;
            const fileName = attachedFiles?.[expKey] || (idx === 0 ? 'InnoTech_Offer_Certificate.pdf' : null);

            return (
              <div
                key={exp.id || idx}
                className="card"
                style={{
                  background: 'var(--surface-1)',
                  border: '0.5px solid var(--border)',
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-light)',
                        color: 'var(--accent-dark)',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      Experience #{idx + 1}
                    </span>
                    <strong style={{ fontSize: 13 }}>
                      {exp.role || 'Role'} {exp.company ? `at ${exp.company}` : ''}
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
                    title="Remove experience"
                    onClick={() => handleRemoveExp(idx)}
                  >
                    ×
                  </button>
                </div>

                {/* Company & Role */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                  <div className="field">
                    <label style={{ fontSize: 12 }}>Company / Organization *</label>
                    <input
                      type="text"
                      value={exp.company || ''}
                      onChange={(e) => handleUpdateExp(idx, 'company', e.target.value)}
                      placeholder="e.g. InnoTech Labs"
                      style={{ background: 'var(--surface-2)' }}
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 12 }}>Role / Title *</label>
                    <input
                      type="text"
                      value={exp.role || ''}
                      onChange={(e) => handleUpdateExp(idx, 'role', e.target.value)}
                      placeholder="e.g. Full Stack Engineering Intern"
                      style={{ background: 'var(--surface-2)' }}
                    />
                  </div>
                </div>

                {/* Start & End Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                  <div className="field">
                    <label style={{ fontSize: 12 }}>Start Date</label>
                    <DatePicker
                      value={exp.start || '2025-06-01'}
                      onChange={(v) => handleUpdateExp(idx, 'start', v)}
                      placeholder="Start date"
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 12 }}>End Date</label>
                    <DatePicker
                      value={exp.end || '2025-08-15'}
                      onChange={(v) => handleUpdateExp(idx, 'end', v)}
                      placeholder="End date"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="field" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12 }}>Summary of Responsibilities & Impact</label>
                  <textarea
                    rows={2}
                    value={exp.description || ''}
                    onChange={(e) => handleUpdateExp(idx, 'description', e.target.value)}
                    placeholder="Describe tools utilized, business impact, endpoints built, optimizations…"
                    style={{ background: 'var(--surface-2)' }}
                  />
                </div>

                {/* Certificate / Offer Letter Attach */}
                <div>
                  <input
                    type="file"
                    ref={(el) => { fileInputRefs.current[expKey] = el; }}
                    accept=".pdf,image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleExpFileChange(expKey, e)}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius)',
                      border: '0.5px solid var(--border)',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: fileName ? 'var(--teal)' : 'var(--text-secondary)' }}>
                      📄 {fileName ? fileName : 'Offer letter / completion certificate (optional)'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={() => fileInputRefs.current[expKey]?.click()}
                    >
                      📎 {fileName ? 'Replace file' : 'Attach document'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Button type="button" variant="outline" size="sm" onClick={handleAddExp}>
          + Add another experience
        </Button>

        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
