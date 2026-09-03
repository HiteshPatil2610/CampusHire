import { Bell, Info, Megaphone } from 'lucide-react'

// Phase 1 — placeholder (drives come in Phase 5)
const MOCK_NOTIFICATIONS = [
  { id: '1', type: 'announcement', title: 'Placement season 2026 begins', message: 'The placement cell is registering students for the upcoming season. Make sure your profile is complete.', time: '2 hours ago', read: false },
  { id: '2', type: 'system',       title: 'Profile completion reminder', message: 'Your profile is 72% complete. Add your projects and experience to improve your readiness score.', time: '1 day ago', read: true },
  { id: '3', type: 'announcement', title: 'TCS Pre-Placement Talk', message: 'TCS will be conducting a PPT on August 25. Attendance is mandatory for eligible students.', time: '2 days ago', read: true },
  { id: '4', type: 'system',       title: 'Welcome to CampusHire', message: 'Your account is active. Start by completing your profile to unlock placement drives.', time: '5 days ago', read: true },
]

export default function NotificationsPage() {
  const unread = MOCK_NOTIFICATIONS.filter(n => !n.read).length

  return (
    <div className="max-w-2xl space-y-5 anim-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Notifications</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unread > 0 && (
          <button className="text-xs text-accent hover:underline">Mark all as read</button>
        )}
      </div>

      {MOCK_NOTIFICATIONS.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-10 text-center">
          <Bell size={32} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {MOCK_NOTIFICATIONS.map(n => (
            <div
              key={n.id}
              className={`flex gap-3 p-4 rounded-xl border transition-all duration-150
                ${n.read ? 'bg-surface-2 border-border' : 'bg-accent-light border-accent/20'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${n.read ? 'bg-surface-1' : 'bg-accent/10'}`}>
                {n.type === 'announcement' ? <Megaphone size={15} className={n.read ? 'text-text-secondary' : 'text-accent'} /> : <Info size={15} className={n.read ? 'text-text-secondary' : 'text-accent'} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${n.read ? 'text-text-primary' : 'text-text-primary font-medium'}`}>{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
                </div>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-xs text-text-muted mt-1.5">{n.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-text-muted pt-2">
        Placement drive notifications will appear here once drives are posted.
      </p>
    </div>
  )
}
