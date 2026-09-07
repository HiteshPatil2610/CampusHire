import { NavLink, useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { NOTIFICATIONS } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = {
  student: [
    { label: 'Home', to: PATHS.home, icon: '🏠' },
    { label: 'Dashboard', to: PATHS.studentDashboard, icon: '⊞' },
    { label: 'Profile', to: PATHS.studentProfile, icon: '◉' },
    { label: 'Resume Builder', to: PATHS.resumeBuilder, icon: '📄' },
    { label: 'AI Analyzer', to: PATHS.aiAnalyzer, icon: '✦' },
    { label: 'Self Assessment', to: PATHS.selfAssessment, icon: '✎' },
    { label: 'Readiness', to: PATHS.readinessDashboard, icon: '◎' },
    { label: 'Notifications', to: PATHS.notifications, icon: '🔔', badgeKey: 'unread' },
    { label: 'Settings', to: PATHS.settings, icon: '⚙' },
  ],
  admin: [
    { label: 'Dashboard', to: PATHS.adminHome, icon: '⊞' },
    { label: 'Students', to: PATHS.adminDashboard, icon: '◉' },
    { label: 'Drives', to: PATHS.postDrive, icon: '🚀' },
    { label: 'Announcements', to: PATHS.announcements, icon: '📢' },
    { label: 'Reports', to: PATHS.reportsAnalytics, icon: '📊' },
  ],
  superadmin: [
    { label: 'Institutional Overview', to: PATHS.superAdminDashboard, icon: '🌐' },
    { label: 'All Students', to: PATHS.superAdminStudents, icon: '◉' },
    { label: 'Campus Drives', to: PATHS.superAdminDrives, icon: '🚀' },
    { label: 'Departments', to: PATHS.departmentManagement, icon: '🏛' },
    { label: 'Admin Accounts', to: PATHS.adminAccounts, icon: '👤' },
    { label: 'Global Reports', to: PATHS.globalReports, icon: '📊' },
    { label: 'Audit Log', to: PATHS.auditLog, icon: '🔍' },
    { label: 'System Settings', to: PATHS.systemSettings, icon: '⚙' },
  ],
};

const ROLE_LABELS = {
  student: 'Student Portal',
  admin: 'Dept Admin',
  superadmin: 'Super Admin / TPO',
};

// role: 'student' | 'admin' | 'superadmin' — ui-context.md §1.4 / FRONTEND_ARCHITECTURE.md §4
export default function Sidebar({ role }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const activeRole = role || 'student';
  const items = NAV_ITEMS[activeRole] || NAV_ITEMS.student;
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  function handleLogout() {
    logout();
    navigate(PATHS.login);
  }

  return (
    <aside className="app-sidebar">
      <div style={{ marginBottom: 20 }}>
        <div
          className="brand-mark"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(PATHS.landing)}
        >
          <span className="brand-dot" />
          <span>CampusHire</span>
        </div>
        <div style={{ marginTop: 6, display: 'inline-block' }}>
          <span
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 12,
              background: 'var(--accent-light)',
              color: 'var(--accent-dark)',
            }}
          >
            {ROLE_LABELS[activeRole] || activeRole}
          </span>
        </div>
      </div>

      <nav className="app-sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </span>
            {item.badgeKey === 'unread' && unread > 0 && (
              <span className="badge badge-accent">{unread}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        {activeRole === 'student' && (
          <NavLink
            to={PATHS.settings}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span aria-hidden>⚙</span> Settings
          </NavLink>
        )}
        <button
          className="sidebar-link"
          style={{ border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}
          onClick={handleLogout}
        >
          <span aria-hidden>→</span> Log out ({user?.name ? user.name.split(' ')[0] : 'User'})
        </button>
      </div>
    </aside>
  );
}
