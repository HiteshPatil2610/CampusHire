import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NOTIFICATIONS } from '../../data/mockData';
import { useAppState } from '../../context/AppStateContext';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';
import Button from '../ui/Button';

// user: { name, initials }. showProfileCompletion: boolean, onSave: fn (only used when true)
export default function Topbar({ user: userProp, showProfileCompletion = false, onSave }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const { state, isNotifRead, markAllNotifsRead } = useAppState();
  const { user: authUser, role, switchRole } = useAuth();
  const navigate = useNavigate();

  const user = authUser || userProp;
  const unreadCount = NOTIFICATIONS.filter((n) => !isNotifRead(n.id)).length;

  function handleProfileClick() {
    if (role === 'superadmin') {
      navigate(PATHS.systemSettings);
    } else if (role === 'admin') {
      navigate(PATHS.adminHome);
    } else {
      navigate(PATHS.studentProfile);
    }
  }

  function handleSwitchRole(newRole) {
    switchRole(newRole);
    setRoleMenuOpen(false);
    if (newRole === 'superadmin') navigate(PATHS.superAdminDashboard);
    else if (newRole === 'admin') navigate(PATHS.adminHome);
    else navigate(PATHS.home);
  }

  return (
    <header className="app-topbar">
      {showProfileCompletion ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            Profile completion: <strong>{state.profileCompletion}%</strong>
          </span>
          <Button size="sm" onClick={onSave}>
            Save changes
          </Button>
        </div>
      ) : (
        <div />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
        {/* Quick Role Switcher for seamless preview testing */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setRoleMenuOpen((o) => !o)}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>Role:</span>
            <strong style={{ textTransform: 'capitalize' }}>{role}</strong>
            <span style={{ fontSize: 10 }}>▼</span>
          </button>

          {roleMenuOpen && (
            <div
              className="card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 200,
                zIndex: 350,
                padding: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ fontSize: 11, padding: '4px 8px', color: 'var(--text-secondary)' }}>
                Switch view role:
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleSwitchRole('student')}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  fontSize: 12,
                  padding: '6px 8px',
                  fontWeight: role === 'student' ? 600 : 400,
                  background: role === 'student' ? 'var(--accent-light)' : 'transparent',
                }}
              >
                🎓 Student
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleSwitchRole('admin')}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  fontSize: 12,
                  padding: '6px 8px',
                  fontWeight: role === 'admin' ? 600 : 400,
                  background: role === 'admin' ? 'var(--accent-light)' : 'transparent',
                }}
              >
                🏛 Dept Admin (CSE)
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleSwitchRole('superadmin')}
                style={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  fontSize: 12,
                  padding: '6px 8px',
                  fontWeight: role === 'superadmin' ? 600 : 400,
                  background: role === 'superadmin' ? 'var(--accent-light)' : 'transparent',
                }}
              >
                👑 Super Admin (TPO)
              </button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            aria-label="Notifications"
            onClick={() => setNotifOpen((o) => !o)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', fontSize: 18 }}
          >
            🔔
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                }}
              />
            )}
          </button>

          {notifOpen && (
            <div
              className="card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 300,
                zIndex: 300,
                padding: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '0.5px solid var(--border)' }}>
                <strong style={{ fontSize: 13 }}>Notifications</strong>
                <Button variant="ghost" size="sm" onClick={markAllNotifsRead}>
                  Mark read
                </Button>
              </div>
              <div>
                {NOTIFICATIONS.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '0.5px solid var(--border)',
                      background: isNotifRead(n.id) ? 'transparent' : 'var(--accent-light)',
                      fontSize: 12,
                    }}
                  >
                    <div>{n.text}</div>
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {n.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User profile */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          onClick={handleProfileClick}
          title="Go to profile"
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--accent-light)',
              color: 'var(--accent-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {user?.initials || 'U'}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{user?.name || 'User'}</span>
        </div>
      </div>
    </header>
  );
}
