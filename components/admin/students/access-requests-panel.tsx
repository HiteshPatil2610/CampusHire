'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { reviewAccessRequest } from '@/features/students/actions/review-access-request';

export interface AccessRequestRow {
  id: string;
  name: string;
  email: string;
  rollNumber: string | null;
  phoneNumber: string;
  entryType: 'REGULAR' | 'DIPLOMA';
  createdAt: Date;
}

export interface AccessRequestsPanelProps {
  requests: AccessRequestRow[];
  departmentCode: string;
}

/**
 * Self-registration requests awaiting this admin's decision.
 *
 * These are people who signed up themselves and whose email matched no row in
 * the imported roster. A sign-up that DID match is linked automatically and
 * never reaches this list — so everything here is someone nobody has vouched
 * for yet. Approving is what creates their Student record.
 */
export default function AccessRequestsPanel({
  requests,
  departmentCode,
}: AccessRequestsPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  function decide(id: string, decision: 'APPROVE' | 'REJECT') {
    setDecidingId(id);

    startTransition(async () => {
      const result = await reviewAccessRequest({
        requestId: id,
        decision,
        note: notes[id]?.trim() || undefined,
      });

      setDecidingId(null);

      if (!result.success) {
        toast({
          title: 'Could not complete',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: decision === 'APPROVE' ? 'Student approved' : 'Request declined',
        description:
          decision === 'APPROVE'
            ? 'They now have access to their student dashboard.'
            : 'They have been told their request was declined.',
      });
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return (
      <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
          No pending access requests
        </div>
        <div className="text-secondary" style={{ fontSize: 12 }}>
          Students who sign up and match your imported roster are approved
          automatically. Anyone who does not match will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {requests.map((request) => (
        <div
          key={request.id}
          style={{
            padding: '14px 18px',
            borderBottom: '0.5px solid var(--border)',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{request.name}</strong>
              <span
                className={`badge ${
                  request.entryType === 'DIPLOMA' ? 'badge-purple' : 'badge-gray'
                }`}
                style={{ fontSize: 10 }}
              >
                {request.entryType === 'DIPLOMA' ? 'Diploma' : 'Regular'}
              </span>
              <span className="badge badge-amber" style={{ fontSize: 10 }}>
                Not in roster
              </span>
            </div>

            <div className="text-secondary" style={{ fontSize: 12, marginTop: 3 }}>
              {request.email}
            </div>
            <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
              Roll no: {request.rollNumber || '—'} · Phone: {request.phoneNumber} ·
              Requested{' '}
              {new Date(request.createdAt).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
              })}
            </div>

            <input
              value={notes[request.id] ?? ''}
              onChange={(e) =>
                setNotes({ ...notes, [request.id]: e.target.value })
              }
              placeholder="Optional note (shown to the student if declined)"
              style={{
                marginTop: 8,
                width: '100%',
                maxWidth: 420,
                padding: '6px 9px',
                fontSize: 12,
                border: '0.5px solid var(--border-strong)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isPending}
              onClick={() => decide(request.id, 'APPROVE')}
            >
              {isPending && decidingId === request.id ? 'Saving…' : 'Approve'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => decide(request.id, 'REJECT')}
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      <div
        className="text-muted"
        style={{ padding: '10px 18px', fontSize: 11 }}
      >
        Approving creates the student record in {departmentCode} and gives them
        dashboard access immediately.
      </div>
    </div>
  );
}
