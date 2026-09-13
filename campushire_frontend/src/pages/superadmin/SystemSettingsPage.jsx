import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import DatePicker from '../../components/ui/DatePicker';
import { SUPER_ADMIN } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';

// Port of system-settings.html — platform-wide configuration (placement season, email templates).
// TODO(real-data): superAdminService.getSystemSettings() / updateSystemSettings(payload).
export default function SystemSettingsPage() {
  const user = { name: SUPER_ADMIN.name, initials: 'VR' };
  const { showToast } = useToast();
  const [settings, setSettings] = useState({
    seasonStart: '2026-07-01',
    seasonEnd: '2027-04-30',
    minCgpaFloor: '5.0',
    allowMultipleApplications: true,
  });

  function set(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  return (
    <AppShell role="superadmin" user={user}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>System Settings</h1>

      <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>Placement season</h3>
        <div className="field-row">
          <div className="field">
            <label>Season start</label>
            <DatePicker value={settings.seasonStart} onChange={(v) => set('seasonStart', v)} />
          </div>
          <div className="field">
            <label>Season end</label>
            <DatePicker value={settings.seasonEnd} onChange={(v) => set('seasonEnd', v)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>Eligibility defaults</h3>
        <div className="field">
          <label>Institution-wide minimum CGPA floor</label>
          <input value={settings.minCgpaFloor} onChange={(e) => set('minCgpaFloor', e.target.value)} />
        </div>
        <div className="pref-row" style={{ borderBottom: 'none' }}>
          <span>Allow students to apply to multiple drives simultaneously</span>
          <button
            className={`toggle-switch ${settings.allowMultipleApplications ? 'on' : ''}`}
            onClick={() => set('allowMultipleApplications', !settings.allowMultipleApplications)}
          >
            <span className="knob" />
          </button>
        </div>
      </div>

      <Button onClick={() => showToast('System settings saved.', 'success')}>Save settings</Button>
    </AppShell>
  );
}
