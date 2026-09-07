import { useRef } from 'react';
import Button from '../../ui/Button';

const SEMESTER_OPTIONS = [
  '1st semester',
  '2nd semester',
  '3rd semester',
  '4th semester',
  '5th semester',
  '6th semester',
  '7th semester',
  '8th semester',
];

function getSemesterNumber(semStr) {
  if (!semStr) return 7;
  const match = String(semStr).match(/\d+/);
  return match ? parseInt(match[0], 10) : 7;
}

export default function TabAcademicInfo({
  form,
  setField,
  onSave,
  attachedFiles,
  setAttachedFile,
  showToast,
}) {
  const tenthFileInputRef = useRef(null);
  const twelfthFileInputRef = useRef(null);

  const currentSemNum = getSemesterNumber(form.semester);
  const maxAllowedSem = Math.max(1, currentSemNum - 1);
  const semesters = form.semesters || [];

  function handleAddSemester() {
    if (semesters.length >= maxAllowedSem) {
      showToast(
        `Cannot add results beyond Semester ${maxAllowedSem} (one below your current ${form.semester || '7th semester'}).`,
        'warning'
      );
      return;
    }

    const nextSemIndex = semesters.length + 1;
    const newSem = {
      label: `Sem ${nextSemIndex}`,
      sgpa: 8.0,
      verified: false,
    };
    setField('semesters', [...semesters, newSem]);
    showToast(`Added Sem ${nextSemIndex} result row.`, 'info');
  }

  function handleSgpaChange(index, value) {
    const updated = [...semesters];
    updated[index] = {
      ...updated[index],
      sgpa: value === '' ? '' : parseFloat(value) || value,
    };
    setField('semesters', updated);
  }

  function handleSemFileChange(semKey, e) {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(semKey, file.name);
      showToast(`Attached marksheet "${file.name}" for ${semKey.toUpperCase()}.`, 'success');
    }
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Academic Credentials
      </h3>

      {/* 10th and 12th Sub-cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* 10th Sub-card */}
        <div
          className="card"
          style={{
            background: 'var(--surface-1)',
            border: '0.5px solid var(--border)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>10th Secondary School</strong>
            <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>* Required</span>
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12 }}>Percentage / CGPA *</label>
            <input
              type="text"
              value={form.tenth || '92%'}
              onChange={(e) => setField('tenth', e.target.value)}
              placeholder="e.g. 92% or 9.4"
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12 }}>Board & Year *</label>
            <input
              type="text"
              value={form.tenthBoard || 'CBSE, 2019'}
              onChange={(e) => setField('tenthBoard', e.target.value)}
              placeholder="e.g. CBSE, 2019"
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <input
              type="file"
              ref={tenthFileInputRef}
              accept=".pdf,image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setAttachedFile('tenthMarksheet', f.name);
                  showToast(`Uploaded 10th Marksheet: ${f.name}`, 'success');
                }
              }}
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
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                📄 {attachedFiles?.tenthMarksheet || '10th_marksheet_verified.pdf'}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => tenthFileInputRef.current?.click()}
              >
                📎 Attach
              </button>
            </div>
          </div>
        </div>

        {/* 12th Sub-card */}
        <div
          className="card"
          style={{
            background: 'var(--surface-1)',
            border: '0.5px solid var(--border)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>12th Higher Secondary / Diploma</strong>
            <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>* Required</span>
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12 }}>Percentage / CGPA *</label>
            <input
              type="text"
              value={form.twelfth || '89%'}
              onChange={(e) => setField('twelfth', e.target.value)}
              placeholder="e.g. 89% or 8.8"
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12 }}>Board & Year *</label>
            <input
              type="text"
              value={form.twelfthBoard || 'CBSE, 2021'}
              onChange={(e) => setField('twelfthBoard', e.target.value)}
              placeholder="e.g. CBSE, 2021"
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <input
              type="file"
              ref={twelfthFileInputRef}
              accept=".pdf,image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setAttachedFile('twelfthMarksheet', f.name);
                  showToast(`Uploaded 12th Marksheet: ${f.name}`, 'success');
                }
              }}
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
              <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                📄 {attachedFiles?.twelfthMarksheet || '12th_marksheet_verified.pdf'}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => twelfthFileInputRef.current?.click()}
              >
                📎 Attach
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Current CGPA & Current Semester */}
      <div
        className="card"
        style={{
          background: 'var(--surface-2)',
          border: '0.5px solid var(--border)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label>Current Cumulative CGPA *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={form.cgpa ?? 8.4}
              onChange={(e) => setField('cgpa', e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              placeholder="8.4"
            />
          </div>

          <div className="field">
            <label>Current Semester *</label>
            <select
              value={form.semester || '7th semester'}
              onChange={(e) => setField('semester', e.target.value)}
            >
              {SEMESTER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Semester Breakdown Section */}
      <div
        className="card"
        style={{
          background: 'var(--surface-2)',
          border: '0.5px solid var(--border)',
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: 14 }}>Semester Grade Breakdown</h4>
          <span
            style={{
              fontSize: 12,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-light)',
              color: 'var(--accent-dark)',
              fontWeight: 500,
            }}
          >
            {semesters.length} of {maxAllowedSem} allowed recorded
          </span>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          ℹ You can add results up to Semester {maxAllowedSem} (one below your current semester: {form.semester || '7th semester'}).
        </p>

        {/* Grid of Semester Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
          {semesters.map((s, idx) => {
            const semFileKey = `sem-${idx + 1}`;
            const fileName = attachedFiles?.[semFileKey];
            return (
              <div
                key={s.label || idx}
                style={{
                  background: 'var(--surface-1)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13 }}>{s.label}</strong>
                  {s.verified ? (
                    <span style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>
                      ✓ Verified
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Pending verification
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                    SGPA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={s.sgpa ?? ''}
                    onChange={(e) => handleSgpaChange(idx, e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      fontSize: 11,
                      padding: '5px 8px',
                      background: 'var(--surface-2)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: fileName ? 'var(--teal)' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={fileName || 'Attach marksheet'}
                  >
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleSemFileChange(semFileKey, e)}
                    />
                    📎 {fileName ? fileName : 'Attach marksheet'}
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={semesters.length >= maxAllowedSem}
            onClick={handleAddSemester}
          >
            + Add semester result
          </Button>
          {semesters.length >= maxAllowedSem && (
            <span style={{ fontSize: 12, color: 'var(--amber)' }}>
              Maximum semester results reached for your current semester ({form.semester || '7th'}).
            </span>
          )}
        </div>
      </div>

      {/* Backlogs */}
      <div
        className="card"
        style={{
          background: 'var(--surface-1)',
          border: '0.5px solid var(--border)',
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h4 style={{ margin: '0 0 12px', fontSize: 13 }}>Backlog History & Academic Standing</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label>Active Backlogs *</label>
            <select
              value={form.activeBacklogs || 'No'}
              onChange={(e) => setField('activeBacklogs', e.target.value)}
            >
              <option value="No">No (0 Active Backlogs)</option>
              <option value="Yes">Yes (Has Active Backlogs)</option>
            </select>
          </div>

          <div className="field">
            <label>Past Backlog History Count</label>
            <input
              type="number"
              min="0"
              value={form.backlogHistory ?? 0}
              onChange={(e) => setField('backlogHistory', parseInt(e.target.value, 10) || 0)}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
