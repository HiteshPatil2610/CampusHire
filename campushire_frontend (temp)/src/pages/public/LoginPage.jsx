import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import Button from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('aditi.sharma@college.edu');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { login } = useAuth();

  const demoAccounts = [
    { label: 'Student', email: 'aditi.sharma@college.edu', role: 'student', hint: 'Aditi Sharma (CSE)' },
    { label: 'Dept Admin', email: 'cse.admin@college.edu', role: 'admin', hint: 'Dr. C. Admin (CSE)' },
    { label: 'Super Admin', email: 'tpo.head@college.edu', role: 'superadmin', hint: 'Dr. V. Rao (TPO)' },
  ];

  async function handleLoginWith(targetEmail, targetPassword, forcedRole = null) {
    setLoading(true);
    try {
      const session = await login(targetEmail, targetPassword, forcedRole);
      showToast(`Welcome back, ${session.user.name}!`, 'success');

      // Determine redirect target
      const fromPath = location.state?.from?.pathname;
      if (fromPath && fromPath !== PATHS.login) {
        navigate(fromPath, { replace: true });
        return;
      }

      if (session.role === 'superadmin') {
        navigate(PATHS.superAdminDashboard);
      } else if (session.role === 'admin') {
        navigate(PATHS.adminHome);
      } else {
        navigate(PATHS.home);
      }
    } catch (err) {
      showToast(err.message || 'Login failed. Please verify credentials.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please enter both your college email and password.', 'error');
      return;
    }
    handleLoginWith(email, password);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Section 1 — Navbar */}
      <nav className="public-navbar" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="brand-mark" style={{ cursor: 'pointer' }} onClick={() => navigate(PATHS.landing)}>
          <span className="brand-dot" />
          <span>CampusHire</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.landing); }} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Home
          </a>
          <Button variant="outline" size="sm" onClick={() => navigate(PATHS.register)}>
            Create account
          </Button>
        </div>
      </nav>

      {/* Auth Card Container */}
      <div className="auth-container page-enter" style={{ flex: 1, padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="auth-card"
          style={{ maxWidth: 440, width: '100%', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 className="section-title" style={{ fontSize: 22, marginBottom: 4 }}>Welcome back</h2>
            <p className="text-secondary" style={{ fontSize: 13 }}>Sign in with your verified college credentials</p>
          </div>

          {/* Section 2 — Quick Fill Panel */}
          <div style={{ marginBottom: 20, padding: 12, background: 'var(--surface-1)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>
              ⚡ Quick Fill Demo Accounts
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {demoAccounts.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  className={`btn btn-sm ${email === a.email ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: 11, padding: '8px 4px', whiteSpace: 'nowrap', borderRadius: 8, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                  onClick={() => {
                    setEmail(a.email);
                    setPassword('password123');
                    handleLoginWith(a.email, 'password123', a.role);
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{a.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.85 }}>({a.role})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3 — Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>College Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                required
              />
            </div>

            <div className="field">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 48 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: 12,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    padding: 4,
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> Remember me
              </label>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate(PATHS.resetPassword); }}
                style={{ color: 'var(--accent-dark)', textDecoration: 'none' }}
              >
                Forgot password?
              </a>
            </div>

            <Button type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14 }}>
              {loading ? 'Authenticating...' : 'Sign in'}
            </Button>
          </form>

          {/* Section 4 — Footer note */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              Dept Admin and Super Admin accounts are created by the placement cell.
            </p>
            <p style={{ fontSize: 12, marginTop: 6, margin: '6px 0 0' }}>
              Are you a student?{' '}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate(PATHS.register); }}
                style={{ color: 'var(--accent-dark)', fontWeight: 600, textDecoration: 'none' }}
              >
                Register as a student →
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
