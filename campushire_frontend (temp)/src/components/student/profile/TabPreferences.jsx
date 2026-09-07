import TagInput from '../../ui/TagInput';
import Button from '../../ui/Button';

const COMPANY_TYPES = ['Product', 'Service', 'Startup', 'Any'];
const RELOCATE_OPTIONS = ['Yes', 'No', 'Open to discussion'];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid'];

export default function TabPreferences({ form, setField, onSave }) {
  const currentWorkModes = Array.isArray(form.workMode) ? form.workMode : ['On-site'];

  function handleWorkModeToggle(mode) {
    const next = currentWorkModes.includes(mode)
      ? currentWorkModes.filter((m) => m !== mode)
      : [...currentWorkModes, mode];
    setField('workMode', next);
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Job Preferences & Career Aspirations
      </h3>

      {/* Preferred Roles */}
      <div className="field" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ margin: 0 }}>Target Job Roles & Designations</label>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Press Enter or comma (,) to add tags
          </span>
        </div>
        <TagInput
          tags={form.preferredRoles || ['Frontend Developer', 'Software Engineer', 'Product roles', 'Full Stack Developer']}
          onChange={(tags) => setField('preferredRoles', tags)}
          placeholder="e.g. DevOps Engineer, Machine Learning Engineer…"
        />
      </div>

      {/* Preferred Locations */}
      <div className="field" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ margin: 0 }}>Preferred Job Locations & Cities</label>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Press Enter or comma (,) to add tags
          </span>
        </div>
        <TagInput
          tags={form.preferredLocations || ['Bangalore', 'Hyderabad', 'Remote', 'Pune']}
          onChange={(tags) => setField('preferredLocations', tags)}
          placeholder="e.g. Mumbai, Delhi NCR, Chennai…"
        />
      </div>

      {/* Company Type & Relocation */}
      <div
        className="card"
        style={{
          background: 'var(--surface-1)',
          border: '0.5px solid var(--border)',
          padding: 18,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="field">
            <label style={{ fontSize: 12 }}>Preferred Company Type</label>
            <select
              value={form.companyType || 'Product'}
              onChange={(e) => setField('companyType', e.target.value)}
              style={{ background: 'var(--surface-2)' }}
            >
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label style={{ fontSize: 12 }}>Willing to Relocate</label>
            <select
              value={form.relocate || 'Yes'}
              onChange={(e) => setField('relocate', e.target.value)}
              style={{ background: 'var(--surface-2)' }}
            >
              {RELOCATE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Work Mode Checkboxes */}
      <div
        className="card"
        style={{
          background: 'var(--surface-1)',
          border: '0.5px solid var(--border)',
          padding: 18,
          marginBottom: 24,
        }}
      >
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>
          Work Mode Preferences
        </label>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {WORK_MODES.map((mode) => {
            const checked = currentWorkModes.includes(mode);
            return (
              <label
                key={mode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: checked ? 600 : 400,
                  color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleWorkModeToggle(mode)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span>{mode}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
