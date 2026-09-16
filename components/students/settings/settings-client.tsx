'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';
import { setMyPlacementOptIn } from '@/features/students/actions/set-placement-opt-in';

export interface SettingsClientProps {
  /** Whether the student is currently participating in campus placement. */
  optedIn: boolean;
  /**
   * Set by a department admin. While locked the student can see their
   * participation but cannot change it — the server enforces this too.
   */
  optedInLocked: boolean;
}

export default function SettingsClient({
  optedIn,
  optedInLocked,
}: SettingsClientProps) {
  const { openUserProfile } = useClerk();
  const { toast } = useToast();
  const router = useRouter();
  const [isSavingOptIn, startOptInTransition] = useTransition();
  const [participating, setParticipating] = useState(optedIn);

  const [prefs, setPrefs] = useState({
    emailDriveAlerts: true,
    emailDeadlineReminders: true,
    smsAlerts: false,
  });

  function toggle(key: keyof typeof prefs) {
    // TODO: wire to server once notification preference model is added
    setPrefs((current) => {
      const updated = { ...current, [key]: !current[key] };
      toast({
        title: 'Preferences updated',
        description: 'Notification preference saved locally for now.',
      });
      return updated;
    });
  }

  function handleOptInToggle() {
    if (optedInLocked) return;

    const next = !participating;
    // Optimistic: a single boolean with a clear success path.
    setParticipating(next);

    startOptInTransition(async () => {
      const result = await setMyPlacementOptIn({ optedIn: next });

      if (!result.success) {
        setParticipating(!next);
        toast({
          title: 'Could not update',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: next ? 'Participating in placement' : 'Opted out of placement',
        description: next
          ? 'You will keep receiving eligible drives.'
          : 'You will no longer be counted as seeking placement.',
      });
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          Settings
        </h1>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Manage your account security, notification alerts, and data preferences.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          maxWidth: 960,
        }}
      >
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6 }}>
            Campus Placement Participation
          </h3>
          <p className="text-secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            Opting out removes you from placement statistics and from the pool
            of students drives are offered to.
          </p>

          <div className="pref-row" style={{ borderBottom: 'none' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                I am participating in campus placement
              </div>
              {optedInLocked && (
                <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                  Locked by your department admin — contact them to change it.
                </div>
              )}
            </div>
            <button
              type="button"
              className={`toggle-switch ${participating ? 'on' : ''}`}
              onClick={handleOptInToggle}
              disabled={optedInLocked || isSavingOptIn}
              aria-label="Toggle campus placement participation"
              aria-pressed={participating}
            >
              <span className="knob" />
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6 }}>
            Notification Preferences
          </h3>
          <p className="text-secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            Control which placement alerts reach your inbox or phone.
          </p>

          <div className="pref-row">
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Email: New drive announcements
              </div>
            </div>
            <button
              type="button"
              className={`toggle-switch ${prefs.emailDriveAlerts ? 'on' : ''}`}
              onClick={() => toggle('emailDriveAlerts')}
              aria-label="Toggle email drive alerts"
            >
              <span className="knob" />
            </button>
          </div>

          <div className="pref-row">
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Email: Deadline reminders
              </div>
            </div>
            <button
              type="button"
              className={`toggle-switch ${prefs.emailDeadlineReminders ? 'on' : ''}`}
              onClick={() => toggle('emailDeadlineReminders')}
              aria-label="Toggle email deadline reminders"
            >
              <span className="knob" />
            </button>
          </div>

          <div className="pref-row" style={{ borderBottom: 'none' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>SMS urgent alerts</div>
            </div>
            <button
              type="button"
              className={`toggle-switch ${prefs.smsAlerts ? 'on' : ''}`}
              onClick={() => toggle('smsAlerts')}
              aria-label="Toggle SMS alerts"
            >
              <span className="knob" />
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6 }}>
            Password & Security
          </h3>
          <p className="text-secondary" style={{ fontSize: 12, marginBottom: 16 }}>
            Password management is handled securely by Clerk.
          </p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => openUserProfile()}
          >
            Manage Password & Security →
          </button>
        </div>

        <div className="card">
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 6 }}>
            Placement Preferences
          </h3>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
            Set preferred job roles, locations, and relocation willingness in your
            profile.
          </p>
          <Link
            href="/student-dashboard/profile"
            className="btn btn-outline btn-sm"
          >
            Edit Placement Preferences →
          </Link>
        </div>
      </div>
    </div>
  );
}
