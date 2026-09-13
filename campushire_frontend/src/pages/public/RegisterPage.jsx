import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import Button from '../../components/ui/Button';
import DatePicker from '../../components/ui/DatePicker';
import GenderToggle from '../../components/ui/GenderToggle';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

// Port of register.html — student self-registration + inline OTP modal.
// TODO(real-data): replace the client-side OTP simulation ('528914')
// with authService.register() -> authService.verifyOtp(). See DUMMY_DATA.md.
export default function RegisterPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: '', rollNo: '', email: '', password: '', confirmPassword: '',
    phone: '', dob: '', department: '', year: '', gender: 'Female', terms: false,
  });
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState(Array(6).fill(''));

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || form.password !== form.confirmPassword || !form.terms || !form.dob) {
      showToast('Please fill all required fields correctly.', 'error');
      return;
    }
    // TODO(real-data): await authService.register(form)
    setOtpOpen(true);
  }

  function handleVerify() {
    // TODO(real-data): await authService.verifyOtp(form.email, otp.join(''))
    navigate(PATHS.home);
  }

  return (
    <div className="auth-container wide page-enter">
      <div className="auth-card">
        <div className="brand-mark" style={{ marginBottom: 24, justifyContent: 'center' }}>
          <span className="brand-dot" />
          <span>CampusHire</span>
        </div>
        <h2 className="section-title" style={{ marginBottom: 16 }}>Create your student account</h2>

        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label>Full name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Roll number</label>
              <input value={form.rollNo} onChange={(e) => set('rollNo', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>College email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@college.edu" />
            <div className="field-hint">Use your official college domain email.</div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
            </div>
            <div className="field">
              <label>Confirm password</label>
              <input type="password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="field">
              <label>Date of birth</label>
              <DatePicker value={form.dob} onChange={(v) => set('dob', v)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Department</label>
              <select value={form.department} onChange={(e) => set('department', e.target.value)}>
                <option value="">Select department</option>
                <option>CSE</option>
                <option>ECE</option>
                <option>Mech</option>
                <option>Civil</option>
              </select>
            </div>
            <div className="field">
              <label>Current year</label>
              <select value={form.year} onChange={(e) => set('year', e.target.value)}>
                <option value="">Select year</option>
                <option>1st</option>
                <option>2nd</option>
                <option>3rd</option>
                <option>4th</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Gender</label>
            <GenderToggle value={form.gender} onChange={(v) => set('gender', v)} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <input type="checkbox" id="terms" checked={form.terms} onChange={(e) => set('terms', e.target.checked)} />
            <label htmlFor="terms" style={{ fontSize: 12 }}>I agree to the Terms & Conditions.</label>
          </div>

          <Button type="submit" style={{ width: '100%', justifyContent: 'center' }}>Create account</Button>
        </form>

        <p className="text-muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          Already have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.login); }} style={{ color: 'var(--accent-dark)' }}>
            Log in
          </a>
        </p>
      </div>

      <Modal open={otpOpen} onClose={() => setOtpOpen(false)}>
        <h3 className="section-title" style={{ textAlign: 'center' }}>Verify your email</h3>
        <p className="text-secondary" style={{ fontSize: 13, textAlign: 'center' }}>
          We sent a 6-digit code to {form.email || 'your email'}.
        </p>
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
        <Button style={{ width: '100%', justifyContent: 'center' }} onClick={handleVerify}>
          Verify and proceed
        </Button>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOtp('528914'.split(''))}
          >
            Demo: Auto-fill code (528914)
          </button>
        </div>
      </Modal>
    </div>
  );
}
