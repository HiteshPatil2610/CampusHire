'use client';

import { useState, useTransition } from 'react';
import type { NotificationEvent, Role } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { setNotificationPreference } from '@/features/notifications/actions/set-notification-preference';
import { NOTIFICATION_EVENTS, optionalEventsFor } from '@/features/notifications/domain/events';

interface NotificationPreferencesProps {
  role: Role;
  mutedEvents: NotificationEvent[];
}

/**
 * What the user can turn off.
 *
 * Only the events the registry marks optional for their role are listed —
 * outcomes, account changes, cancellations and system alerts are not
 * negotiable and so are not shown as choices. Urgent announcements arrive
 * whatever is set here, which the footnote says plainly.
 */
export function NotificationPreferences({ role, mutedEvents }: NotificationPreferencesProps) {
  const { toast } = useToast();
  const [muted, setMuted] = useState<Set<string>>(new Set(mutedEvents));
  const [isPending, startTransition] = useTransition();
  const events = optionalEventsFor(role);

  function toggle(event: NotificationEvent) {
    const enabled = muted.has(event); // turning it back on
    const next = new Set(muted);
    if (enabled) next.delete(event);
    else next.add(event);
    setMuted(next);

    startTransition(async () => {
      const result = await setNotificationPreference({ event, enabled });
      if (!result.success) {
        setMuted(new Set(muted));
        toast({ title: 'Could not save', description: result.error, variant: 'destructive' });
      }
    });
  }

  if (events.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 className="section-title">Notification preferences</h2>
      <p className="text-secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        Choose what you want to be told about in CampusHire. Everything else —
        outcomes, cancellations, access decisions and system alerts — is always
        delivered.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.map((event) => {
          const definition = NOTIFICATION_EVENTS[event];
          const on = !muted.has(event);
          return (
            <label
              key={event}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                border: '0.5px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface-1)',
                cursor: isPending ? 'progress' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={isPending}
                onChange={() => toggle(event)}
                style={{ marginTop: 2 }}
              />
              <span>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>
                  {definition.label}
                </span>
                <span className="text-secondary" style={{ fontSize: 12 }}>
                  {definition.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="text-muted" style={{ fontSize: 11, marginTop: 10 }}>
        CampusHire notifies you inside the app only — no email or SMS is sent.
        An announcement marked urgent by the placement office always appears.
      </p>
    </div>
  );
}
