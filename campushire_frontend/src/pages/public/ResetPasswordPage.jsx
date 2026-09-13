import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import Button from '../../components/ui/Button';

// Port of reset-password.html — 3-step password recovery flow.
// TODO(real-data): wire step transitions to authService.requestPasswordReset()
// and authService.resetPassword().
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number', met: /\d/.test(password) },
    { label: 'Contains an uppercase letter', met: /[A-Z]/.test(password) },
  ];

  return (
    <div className="auth-container page-enter">
      <div className="auth-card">
        {step === 1 && (
          <>
            <h2 className="section-title" style={{ marginBottom: 12 }}>Reset your password</h2>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button style={{ width: '100%', justifyContent: 'center' }} onClick={() => setStep(2)}>
              Send recovery link
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="section-title" style={{ marginBottom: 12 }}>Set a new password</h2>
            <div className="field">
              <label>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <ul style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px', paddingLeft: 18 }}>
              {requirements.map((r) => (
                <li key={r.label} style={{ color: r.met ? 'var(--teal)' : 'var(--text-muted)' }}>
                  {r.met ? '✓' : '○'} {r.label}
                </li>
              ))}
            </ul>
            <div className="field">
              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={!password || password !== confirm}
              onClick={() => setStep(3)}
            >
              Update password
            </Button>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <h2 className="section-title" style={{ marginTop: 8 }}>Password updated</h2>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
              You can now log in with your new password.
            </p>
            <Button style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate(PATHS.login)}>
              Go to login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
