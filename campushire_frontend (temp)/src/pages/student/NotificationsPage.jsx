import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { NOTIFICATIONS } from '../../data/mockData';

export default function NotificationsPage() {
  const student = useStudent();
  const { isNotifRead, markNotifRead, markAllNotifsRead } = useAppState();
  const { showToast } = useToast();
  const [filter, setFilter] = useState('All');

  const filteredNotifications = NOTIFICATIONS.filter((n) => {
    const read = isNotifRead(n.id);
    if (filter === 'Unread') return !read;
    if (filter === 'Drives') return n.text.toLowerCase().includes('drive') || n.text.toLowerCase().includes('tcs') || n.text.toLowerCase().includes('infosys') || n.text.toLowerCase().includes('wipro');
    if (filter === 'System') return n.text.toLowerCase().includes('profile') || n.text.toLowerCase().includes('assessment') || n.text.toLowerCase().includes('resume') || n.text.toLowerCase().includes('portal');
    return true;
  });

  function handleItemClick(n) {
    if (!isNotifRead(n.id)) {
      markNotifRead(n.id);
      showToast('Notification marked as read.', 'info');
    }
  }

  function handleMarkAll() {
    markAllNotifsRead();
    showToast('All notifications marked as read.', 'success');
  }

  return (
    <AppShell role="student" user={student}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Notifications</h1>
          <p className="text-secondary" style={{ fontSize: 13 }}>
            Stay updated with drive deadlines, assessment invitations, and profile reviews.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAll}>
          Mark all as read
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['All', 'Unread', 'Drives', 'System'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`filter-pill ${filter === tab ? 'active' : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No notifications in this category.
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const read = isNotifRead(n.id);
            return (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: read ? 'transparent' : 'var(--accent-light)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                  transition: 'background 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: read ? 'transparent' : 'var(--accent-dark)',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: read ? 400 : 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {n.text}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {n.time}
                  </div>
                </div>
                {!read && (
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>New</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

