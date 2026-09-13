import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import Button from '../../components/ui/Button';

// Port of otp-verification.html — standalone OTP page (separate from register.html's inline modal).
// TODO(real-data): replace sessionStorage email read + demo auto-fill with authService.verifyOtp()/resendOtp().
export default function OtpVerificationPage() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(Array(6).fill(''));
  const [countdown, setCountdown] = useState(45);
  const email = sessionStorage.getItem('reg_email') || 'your registered email';

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="auth-container page-enter">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>📬</div>
        <h2 className="section-title" style={{ marginTop: 8 }}>Verify your email</h2>
        <p className="text-secondary" style={{ fontSize: 13 }}>Code sent to {email}</p>

        <div className="otp-boxes">
          {otp.map((digit, i) => (
            <input
              key={i}
              className="otp-box"
              maxLength={1}
              value={digit}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setOtp((prev) => prev.map((d, idx) => (idx === i ? v : d)));
                if (v && e.target.nextElementSibling) e.target.nextElementSibling.focus();
              }}
            />
          ))}
        </div>

        <Button style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate(PATHS.home)}>
          Verify
        </Button>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOtp('528914'.split(''))}>
            Demo: Auto-fill code (528914)
          </button>
          <span className="text-muted" style={{ fontSize: 12 }}>
            {countdown > 0 ? `Resend available in ${countdown}s` : (
              <a href="#" onClick={(e) => { e.preventDefault(); setCountdown(45); }} style={{ color: 'var(--accent-dark)' }}>
                Resend code
              </a>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
