import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useStudent } from '../../hooks/useStudent';
import { useToast } from '../../context/ToastContext';
import { useAppState } from '../../context/AppStateContext';
import { PATHS } from '../../routes/paths';

export default function SettingsPage() {
  const student = useStudent();
  const { showToast } = useToast();
  const { resetState } = useAppState();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState({
    emailDriveAlerts: true,
    emailDeadlineReminders: true,
    smsAlerts: false,
  });

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  function toggle(key) {
    setPrefs((p) => {
      const updated = { ...p, [key]: !p[key] };
      showToast('Notification preferences saved.', 'info');
      return updated;
    });
  }

  function handlePasswordUpdate(e) {
    e.preventDefault();
    if (!currentPw) {
      showToast('Please enter your current password.', 'error');
      return;
    }
    if (newPw.length < 8) {
      showToast('New password must be at least 8 characters long.', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    showToast('Password updated successfully.', 'success');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  }

  function handleResetAccount() {
    resetState();
    setIsResetModalOpen(false);
    showToast('Account data reset to demo defaults.', 'info');
    navigate(PATHS.home);
  }

  return (
    <AppShell role="student" user={student}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Settings</h1>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Manage your account security, notification alerts, and data preferences.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, maxWidth: 960 }}>
        {/* Card 1: Notification Preferences */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6 }}>Notification Preferences</h3>
          <p className="text-secondary" style={{ fontSize: 12, marginBottom: 16 }}>Control which placement alerts reach your inbox or phone.</p>

          <div className="pref-row">
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Email: New drive announcements</div>
              <div className="text-muted" style={{ fontSize: 11 }}>Instant notifications when eligible drives are posted</div>
            </div>
            <button
              type="button"
              className={`toggle-switch ${prefs.emailDriveAlerts ? 'on' : ''}`}
              onClick={() => toggle('emailDriveAlerts')}
              aria-label="Toggle email drive alerts"
            >
              <span className="knob" />
            </button>
          </div>

          <div className="pref-row">
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Email: Deadline reminders</div>
              <div className="text-muted" style={{ fontSize: 11 }}>Remind 24 hours prior to application close</div>
            </div>
            <button
              type="button"
              className={`toggle-switch ${prefs.emailDeadlineReminders ? 'on' : ''}`}
              onClick={() => toggle('emailDeadlineReminders')}
              aria-label="Toggle email deadline reminders"
            >
              <span className="knob" />
            </button>
          </div>

          <div className="pref-row" style={{ borderBottom: 'none' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>SMS Urgent alerts</div>
              <div className="text-muted" style={{ fontSize: 11 }}>Critical interview slot scheduling via SMS</div>
            </div>
            <button
              type="button"
              className={`toggle-switch ${prefs.smsAlerts ? 'on' : ''}`}
              onClick={() => toggle('smsAlerts')}
              aria-label="Toggle SMS alerts"
            >
              <span className="knob" />
            </button>
          </div>
        </div>

        {/* Card 2: Change Password */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6 }}>Change Password</h3>
          <p className="text-secondary" style={{ fontSize: 12, marginBottom: 16 }}>Use a strong password with letters and numbers.</p>

          <form onSubmit={handlePasswordUpdate}>
            <div className="field">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="field">
              <label>New Password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            <div className="field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>

            <Button type="submit" size="sm" style={{ marginTop: 8 }}>
              Update Password
            </Button>
          </form>
        </div>

        {/* Card 3: Placement Preferences Link */}
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6 }}>Placement Preferences</h3>
          <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
            Set preferred job roles, primary work locations, work mode (Remote/On-site), and relocation willingness in your profile.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate(PATHS.studentProfile)}>
            Edit Placement Preferences →
          </Button>
        </div>

        {/* Card 4: Danger Zone */}
        <div className="danger-zone" style={{ padding: 20, borderRadius: 14 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6, color: 'var(--red)' }}>Reset Demo Data</h3>
          <p style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16, color: 'var(--text-secondary)' }}>
            Reset local applications, draft submissions, and resume optimizations back to default demo state.
          </p>
          <Button variant="danger" size="sm" onClick={() => setIsResetModalOpen(true)}>
            Reset Demo Data
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isResetModalOpen && (
        <Modal title="Confirm Data Reset" onClose={() => setIsResetModalOpen(false)}>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Are you sure you want to reset all applied drives, assessments, and profile overrides back to the clean demo data?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" onClick={() => setIsResetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleResetAccount}>
              Yes, Reset Data
            </Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

