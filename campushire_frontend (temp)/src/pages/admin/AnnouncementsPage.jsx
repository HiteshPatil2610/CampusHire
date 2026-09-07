import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import DatePicker from '../../components/ui/DatePicker';
import UrlField from '../../components/ui/UrlField';
import { DEPT_ADMIN } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';

// Port of announcements.html — dept admin composes announcements to students.
export default function AnnouncementsPage() {
  const user = { name: DEPT_ADMIN.name, initials: 'DA' };
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [eventDate, setEventDate] = useState('2026-09-18');
  const [link, setLink] = useState('');
  const [sent, setSent] = useState([
    { id: 1, title: 'Placement drive briefing — Aug 12', time: '2 days ago', date: '2026-08-12', link: 'https://college.edu/placements/briefing' },
    { id: 2, title: 'Resume submission deadline extended', time: '5 days ago', date: '2026-08-15', link: '' },
  ]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const formattedLink = link ? (link.startsWith('http') ? link : `https://${link}`) : '';
    setSent([
      { id: Date.now(), title, time: 'Just now', date: eventDate, link: formattedLink },
      ...sent,
    ]);
    setTitle('');
    setBody('');
    setLink('');
    showToast('Announcement sent to all department students.', 'success');
  }

  return (
    <AppShell role="admin" user={user}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Announcements</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <form className="card" onSubmit={handleSubmit}>
          <div className="field">
            <label>Title *</label>
            <input
              required
              placeholder="e.g. Mandatory Pre-Placement Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field-row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Event / Deadline Date (Optional)</label>
              <DatePicker
                value={eventDate}
                onChange={setEventDate}
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Reference Document / Meeting URL (Optional)</label>
            <UrlField
              prefix="https://"
              placeholder="meet.google.com/... or docs.google.com/..."
              value={link.replace(/^https?:\/\//i, '')}
              onChange={setLink}
            />
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Message Content</label>
            <textarea
              rows={4}
              placeholder="Provide briefing details, instructions, or agenda..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <Button type="submit" style={{ marginTop: 14 }}>
            Send to {DEPT_ADMIN.department} Students
          </Button>
        </form>

        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 12 }}>Sent announcements</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sent.map((a) => (
              <div className="activity-item" key={a.id} style={{ alignItems: 'flex-start' }}>
                <div className="activity-dot" style={{ marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    <span className="activity-time">{a.time}</span>
                    {a.date && (
                      <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--surface-hover)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        📅 {a.date}
                      </span>
                    )}
                    {a.link && (
                      <a
                        href={a.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        🔗 Open link ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
