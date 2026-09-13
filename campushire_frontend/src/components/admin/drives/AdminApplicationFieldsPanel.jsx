import { useState } from 'react';
import { AVAILABLE_STUDENT_FIELDS, FIELD_PRESETS } from '../../../data/applicationFieldsCatalog';
import Button from '../../ui/Button';

export default function AdminApplicationFieldsPanel({ fields = [], onChange, onPreview }) {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customField, setCustomField] = useState({ label: '', description: '', required: true });

  // Current active fields list
  const activeFields = fields || [];
  const activeKeys = new Set(activeFields.map((f) => f.key));

  // Count metrics
  const mandatoryCount = activeFields.filter((f) => f.required).length;
  const optionalCount = activeFields.filter((f) => !f.required).length;

  // Categories in catalog
  const categories = ['All', 'Basic Identity', 'Academic Records', 'Contact Info', 'Documents & Portfolios', 'Technical Profile'];

  // Available catalog fields that aren't added yet
  const availableToAdd = AVAILABLE_STUDENT_FIELDS.filter((f) => {
    if (activeKeys.has(f.key)) return false;
    if (catalogCategory !== 'All' && f.category !== catalogCategory) return false;
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      return f.label.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
    }
    return true;
  });

  function handleAddField(catalogItem) {
    const newField = {
      key: catalogItem.key,
      label: catalogItem.label,
      source: catalogItem.source || 'profile',
      category: catalogItem.category || 'Profile Data',
      icon: catalogItem.icon || '📌',
      description: catalogItem.description || '',
      required: catalogItem.defaultRequired ?? true,
      enabled: true,
    };
    onChange?.([...activeFields, newField]);
  }

  function handleRemoveField(keyToRemove) {
    onChange?.(activeFields.filter((f) => f.key !== keyToRemove));
  }

  function handleToggleRequired(keyToToggle) {
    onChange?.(
      activeFields.map((f) => {
        if (f.key === keyToToggle) {
          return { ...f, required: !f.required };
        }
        return f;
      })
    );
  }

  function applyPreset(presetKey) {
    const preset = FIELD_PRESETS[presetKey];
    if (!preset) return;

    setSelectedPreset(presetKey);
    const newFields = preset.keys.map((key) => {
      const catalogItem = AVAILABLE_STUDENT_FIELDS.find((f) => f.key === key);
      return {
        key,
        label: catalogItem?.label || key,
        source: catalogItem?.source || 'profile',
        category: catalogItem?.category || 'General',
        icon: catalogItem?.icon || '📌',
        description: catalogItem?.description || '',
        required: catalogItem?.defaultRequired ?? true,
        enabled: true,
      };
    });
    onChange?.(newFields);
  }

  function handleAddCustomField(e) {
    e.preventDefault();
    if (!customField.label.trim()) return;

    const key = `custom_${Date.now()}`;
    const newField = {
      key,
      label: customField.label.trim(),
      source: 'student_input',
      category: 'Custom Field',
      icon: '📝',
      description: customField.description.trim() || 'Custom information requested by placement admin',
      required: customField.required,
      enabled: true,
    };

    onChange?.([...activeFields, newField]);
    setCustomField({ label: '', description: '', required: true });
    setShowCustomModal(false);
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📋</span>
            <span>Required Student Application Fields</span>
          </h3>
          <p className="text-secondary" style={{ fontSize: 13, margin: '4px 0 0' }}>
            Choose which fields students must supply to apply for this drive. Pre-filled from the student's completed profile.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onPreview && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onPreview}
              style={{ fontSize: 12 }}
            >
              👁 Preview Student Form
            </button>
          )}
          <span
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 12,
              background: 'var(--accent-light)',
              color: 'var(--accent-dark)',
              fontWeight: 600,
            }}
          >
            {activeFields.length} Fields Configured ({mandatoryCount} Mandatory, {optionalCount} Optional)
          </span>
        </div>
      </div>

      {/* Info notice */}
      <div
        style={{
          background: 'var(--surface-1)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: 12,
          color: 'var(--text-primary)',
          margin: '14px 0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 16 }}>💡</span>
        <span>
          <strong>Profile Integration:</strong> All selected fields (e.g. Full Name, Roll No, CGPA, Resume, Technical Skills, GitHub, etc.) are verified and pre-populated directly from the student's profile records when they click <em>Apply Now</em>.
        </span>
      </div>

      {/* Quick Presets */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          QUICK APPLICATION PRESETS:
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(FIELD_PRESETS).map(([key, p]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${selectedPreset === key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => applyPreset(key)}
              title={p.description}
              style={{ fontSize: 12 }}
            >
              ⚡ {p.name}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelectedPreset(null);
              onChange?.([]);
            }}
            style={{ fontSize: 11, color: 'var(--red)' }}
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Add Field & Catalog controls */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--surface-0)',
          padding: 12,
          borderRadius: 8,
          border: '0.5px solid var(--border)',
        }}
      >
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowCatalogDropdown(!showCatalogDropdown)}
          style={{ fontSize: 12 }}
        >
          {showCatalogDropdown ? '✕ Close Field Catalog' : '➕ Add Field from Profile Catalog'}
        </button>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setShowCustomModal(true)}
          style={{ fontSize: 12 }}
        >
          ➕ Add Custom Field
        </button>

        <span className="text-muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
          {availableToAdd.length} more profile fields available in catalog
        </span>
      </div>

      {/* Catalog Selector Dropdown Tray */}
      {showCatalogDropdown && (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            padding: 14,
            marginBottom: 18,
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search field by name or keyword..."
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              style={{
                flex: '1 1 220px',
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: '0.5px solid var(--border-strong)',
              }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatalogCategory(c)}
                  className={`btn btn-sm ${catalogCategory === c ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {availableToAdd.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              All fields in this category are already added to this drive!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {availableToAdd.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleAddField(item)}
                  style={{
                    padding: '8px 10px',
                    border: '0.5px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--surface-0)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span style={{ fontSize: 16 }}>{item.icon || '📌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.label}
                    </div>
                    <div className="text-muted" style={{ fontSize: 10, marginTop: 1 }}>
                      {item.category} · {item.source}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 'bold' }}>＋</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Fields Table / List */}
      {activeFields.length === 0 ? (
        <div
          style={{
            border: '1.5px dashed var(--border-strong)',
            borderRadius: 8,
            padding: '30px 20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📑</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No Application Fields Configured</div>
          <div style={{ fontSize: 12, maxWidth: 420, margin: '0 auto 14px' }}>
            Click one of the Quick Presets above (e.g. Standard Core) or add fields from the profile catalog to specify what students must provide.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => applyPreset('standard')}
          >
            Apply Standard Core Fields
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr style={{ background: 'var(--surface-1)' }}>
                <th style={{ width: '38%' }}>Field Name & Source</th>
                <th style={{ width: '22%' }}>Category</th>
                <th style={{ width: '25%' }}>Requirement Status</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeFields.map((field, index) => {
                const catalogItem = AVAILABLE_STUDENT_FIELDS.find((f) => f.key === field.key);
                const icon = field.icon || catalogItem?.icon || '📌';
                const isMandatory = field.required ?? true;

                return (
                  <tr key={field.key || index}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{icon}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {field.label}
                            {isMandatory && <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            Source: {field.source === 'resume' ? 'Placement Resume' : field.source === 'upload' ? 'File Upload' : 'Student Profile'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: 'var(--surface-1)',
                          color: 'var(--text-secondary)',
                          border: '0.5px solid var(--border)',
                        }}
                      >
                        {field.category || catalogItem?.category || 'General'}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleRequired(field.key)}
                        className={`btn btn-sm ${isMandatory ? 'btn-primary' : 'btn-outline'}`}
                        style={{
                          fontSize: 11,
                          padding: '3px 10px',
                          borderRadius: 14,
                          background: isMandatory ? 'var(--accent)' : 'transparent',
                          color: isMandatory ? '#fff' : 'var(--text-secondary)',
                        }}
                        title="Click to toggle between Mandatory and Optional"
                      >
                        {isMandatory ? '✓ Mandatory (*)' : '○ Optional'}
                      </button>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.key)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)', padding: '4px 8px' }}
                        title="Remove field"
                      >
                        ✕ Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Custom Field Modal */}
      {showCustomModal && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCustomModal(false);
          }}
        >
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <h3 className="section-title">Add Custom Application Field</h3>
            <p className="text-secondary" style={{ fontSize: 12, margin: '6px 0 16px' }}>
              Add a bespoke question or requirement for this recruitment drive.
            </p>

            <form onSubmit={handleAddCustomField}>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Field Name / Label *</label>
                <input
                  required
                  placeholder="e.g. Valid Passport Number / US Visa Status"
                  value={customField.label}
                  onChange={(e) => setCustomField((c) => ({ ...c, label: e.target.value }))}
                />
              </div>

              <div className="field" style={{ marginBottom: 12 }}>
                <label>Short Description / Instructions for Student</label>
                <input
                  placeholder="e.g. Enter 8-digit passport number if available"
                  value={customField.description}
                  onChange={(e) => setCustomField((c) => ({ ...c, description: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
                <input
                  type="checkbox"
                  id="customReq"
                  checked={customField.required}
                  onChange={(e) => setCustomField((c) => ({ ...c, required: e.target.checked }))}
                />
                <label htmlFor="customReq" style={{ fontSize: 13, cursor: 'pointer' }}>
                  Student must answer/provide this field to submit application
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCustomModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Add Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
