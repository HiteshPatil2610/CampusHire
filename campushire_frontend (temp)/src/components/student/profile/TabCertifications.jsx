import DatePicker from '../../ui/DatePicker';
import UrlField from '../../ui/UrlField';
import Button from '../../ui/Button';

export default function TabCertifications({ form, setField, onSave, showToast }) {
  const certs = form.certifications || [];

  function handleUpdateCert(index, field, value) {
    const updated = [...certs];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setField('certifications', updated);
  }

  function handleRemoveCert(index) {
    const updated = certs.filter((_, i) => i !== index);
    setField('certifications', updated);
    showToast('Certification removed.', 'info');
  }

  function handleAddCert() {
    const newCert = {
      id: Date.now(),
      title: '',
      issuer: '',
      date: new Date().toISOString().split('T')[0],
      link: '',
    };
    setField('certifications', [...certs, newCert]);
    showToast('Added new certification card.', 'info');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>
            Licenses & Professional Certifications
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Showcase industry certifications, cloud badges, and verified credentials.
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleAddCert}>
          + Add certification
        </Button>
      </div>

      {certs.length === 0 ? (
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
            No certifications added yet.
          </p>
          <Button type="button" size="sm" onClick={handleAddCert}>
            + Add first certification
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {certs.map((c, idx) => (
            <div
              key={c.id || idx}
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
                      background: 'var(--teal-light)',
                      color: 'var(--teal)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Badge #{idx + 1}
                  </span>
                  <strong style={{ fontSize: 13 }}>
                    {c.title || 'Certification Title'}
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
                  title="Remove certification"
                  onClick={() => handleRemoveCert(idx)}
                >
                  ×
                </button>
              </div>

              {/* Title & Issuer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                <div className="field">
                  <label style={{ fontSize: 12 }}>Certification Title *</label>
                  <input
                    type="text"
                    value={c.title || ''}
                    onChange={(e) => handleUpdateCert(idx, 'title', e.target.value)}
                    placeholder="e.g. AWS Certified Cloud Practitioner"
                    style={{ background: 'var(--surface-2)' }}
                  />
                </div>

                <div className="field">
                  <label style={{ fontSize: 12 }}>Issuing Organization *</label>
                  <input
                    type="text"
                    value={c.issuer || ''}
                    onChange={(e) => handleUpdateCert(idx, 'issuer', e.target.value)}
                    placeholder="e.g. Amazon Web Services"
                    style={{ background: 'var(--surface-2)' }}
                  />
                </div>
              </div>

              {/* Date Issued & Credential Link */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="field">
                  <label style={{ fontSize: 12 }}>Date Issued</label>
                  <DatePicker
                    value={c.date || '2025-02-10'}
                    onChange={(v) => handleUpdateCert(idx, 'date', v)}
                    placeholder="Date issued"
                  />
                </div>

                <div className="field">
                  <label style={{ fontSize: 12 }}>Credential Verification URL</label>
                  <UrlField
                    prefix="https://"
                    value={(c.link || '').replace(/^https?:\/\//i, '')}
                    onChange={(val) => handleUpdateCert(idx, 'link', val)}
                    placeholder="aws.amazon.com/verify/..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Button type="button" variant="outline" size="sm" onClick={handleAddCert}>
          + Add another certification
        </Button>

        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
