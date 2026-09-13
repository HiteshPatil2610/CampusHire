import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';
import Button from '../ui/Button';

/**
 * ProtectedRoute: Enforces authentication and Role-Based Access Control (RBAC).
 *
 * @param {Object} props
 * @param {string[]} props.allowedRoles - e.g. ['student'], ['admin'], ['superadmin']
 * @param {React.ReactNode} props.children
 */
export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, role, user, switchRole, logout } = useAuth();
  const location = useLocation();

  // 1. If not authenticated, redirect to Login
  if (!isAuthenticated) {
    return <Navigate to={PATHS.login} state={{ from: location }} replace />;
  }

  // 2. If role is not allowed, show role mismatch screen with quick redirection
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const roleDashboardMap = {
      student: PATHS.home,
      admin: PATHS.adminHome,
      superadmin: PATHS.superAdminDashboard,
    };

    const targetDashboard = roleDashboardMap[role] || PATHS.landing;

    return (
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛡️</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Access Restricted</h2>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
            This page is restricted to <strong>{allowedRoles.join(' or ')}</strong> accounts.
            You are currently signed in as <strong>{user?.name}</strong> ({role}).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <Button
              onClick={() => {
                window.location.href = targetDashboard;
              }}
            >
              Go to your {role} dashboard
            </Button>

            <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Quick switch to preview as another role:
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {allowedRoles.map((r) => (
                  <Button
                    key={r}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      switchRole(r);
                    }}
                  >
                    Switch to {r}
                  </Button>
                ))}
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={logout} style={{ marginTop: 8 }}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
