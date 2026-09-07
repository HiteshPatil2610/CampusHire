import { useRef } from 'react';
import DatePicker from '../../ui/DatePicker';
import GenderToggle from '../../ui/GenderToggle';
import Button from '../../ui/Button';

function calculateAge(dobStr) {
  if (!dobStr) return null;
  const birth = new Date(dobStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export default function TabPersonalInfo({
  form,
  setField,
  onSave,
  photoPreview,
  setPhotoPreview,
  showToast,
}) {
  const photoInputRef = useRef(null);
  const calculatedAge = calculateAge(form.dob);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP).', 'error');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    showToast(`Profile photo preview set to "${file.name}" (demo mode).`, 'info');
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Personal Information
      </h3>

      {/* Primary Email (Locked) */}
      <div
        className="locked-email-row"
        style={{
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
        }}
      >
        <span style={{ fontSize: 18 }}>✉</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {form.email || 'aditi.sharma@college.edu'}
            </span>
            <span className="le-badge">🔒 Verified</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            (cannot be changed here — it's the login email)
          </span>
        </div>
      </div>

      {/* Change Photo Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 16px',
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            overflow: 'hidden',
            background: 'var(--accent-light)',
            color: 'var(--accent-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 20,
            border: '2px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {photoPreview ? (
            <img
              src={photoPreview}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            form.initials || 'AS'
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Profile Photo</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
            Upload a clear, professional passport-style photo for campus recruitment passes.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => photoInputRef.current?.click()}
            >
              📷 Change photo
            </Button>
            {photoPreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPhotoPreview(null)}
              >
                Reset to default
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Name and DOB */}
      <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="field">
          <label>Full Name *</label>
          <input
            type="text"
            value={form.name || ''}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Aditi Sharma"
          />
        </div>
        <div className="field">
          <label>Date of Birth *</label>
          <DatePicker
            value={form.dob || '2004-03-12'}
            onChange={(v) => setField('dob', v)}
            placeholder="Select date of birth"
          />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {calculatedAge !== null ? (
              <span>🎂 Age: <strong>{calculatedAge} years old</strong> (calculated in real-time)</span>
            ) : (
              <span>Select date of birth</span>
            )}
          </div>
        </div>
      </div>

      {/* Phone and Alternate Email */}
      <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
        <div className="field">
          <label>Phone Number *</label>
          <input
            type="tel"
            value={form.phone || ''}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="98765 43210"
          />
        </div>
        <div className="field">
          <label>Alternate / Personal Email</label>
          <input
            type="email"
            value={form.personalEmail || ''}
            onChange={(e) => setField('personalEmail', e.target.value)}
            placeholder="aditi.personal@gmail.com"
          />
        </div>
      </div>

      {/* Current Address */}
      <div className="field" style={{ marginTop: 12 }}>
        <label>Current Address</label>
        <textarea
          rows={3}
          value={form.address || ''}
          onChange={(e) => setField('address', e.target.value)}
          placeholder="Flat 402, Green Glen Layout, Bellandur, Bengaluru"
        />
      </div>

      {/* Gender */}
      <div className="field" style={{ marginTop: 12, marginBottom: 24 }}>
        <label>Gender</label>
        <GenderToggle
          value={form.gender || 'Female'}
          onChange={(v) => setField('gender', v)}
        />
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
