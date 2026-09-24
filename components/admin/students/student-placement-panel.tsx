'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  getStudentPlacements,
  type PlacementView,
} from '@/features/students/queries/get-student-placements';
import {
  recordManualPlacement,
  revokePlacement,
} from '@/features/students/actions/manage-placement';

/**
 * A student's placements for an admin: the history (active and revoked, with
 * who, when and why), recording an off-campus placement, and revoking one
 * recorded by mistake.
 *
 * Every action is authorized on the server — the department admin's own
 * students only (Super Admin may revoke anywhere). Placements from a
 * CampusHire drive are not added here: selecting the application creates
 * them.
 */
export function StudentPlacementPanel({
  studentId,
  canRecord,
  onChanged,
}: {
  studentId: string;
  /** Department admins record placements; the Super Admin only reviews. */
  canRecord: boolean;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [placements, setPlacements] = useState<PlacementView[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState({
    companyName: '',
    roleName: '',
    packageDisplay: '',
    placedAt: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(() => {
    getStudentPlacements(studentId)
      .then(setPlacements)
      .catch(() => setPlacements([]));
  }, [studentId]);

  useEffect(load, [load]);

  const done = (message: string) => {
    toast({ title: message });
    load();
    onChanged?.();
  };

  const record = () =>
    startTransition(async () => {
      const result = await recordManualPlacement({
        studentId,
        companyName: form.companyName,
        roleName: form.roleName,
        packageDisplay: form.packageDisplay,
        placedAt: form.placedAt,
      });
      if (result.success) {
        setFormOpen(false);
        done('Placement recorded');
      } else {
        toast({ title: 'Could not record placement', description: result.error, variant: 'destructive' });
      }
    });

  const revoke = (placementId: string) =>
    startTransition(async () => {
      const result = await revokePlacement({ placementId, reason });
      if (result.success) {
        setRevoking(null);
        setReason('');
        done('Placement revoked');
      } else {
        toast({ title: 'Could not revoke placement', description: result.error, variant: 'destructive' });
      }
    });

  const active = (placements ?? []).filter((placement) => !placement.revokedAt);
  const input: React.CSSProperties = { padding: '6px 8px', fontSize: 12 };

  return (
    <div className="card" style={{ padding: '10px 12px', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Placement
        </div>
        {canRecord && !formOpen && (
          <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={() => setFormOpen(true)}>
            ＋ Record off-campus placement
          </button>
        )}
      </div>

      {placements === null && <div className="text-muted" style={{ fontSize: 12 }}>Loading…</div>}

      {placements && placements.length === 0 && (
        <div className="text-muted" style={{ fontSize: 12 }}>Not placed.</div>
      )}

      {active.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Placed — permanently excluded from new placement drives. Existing applications are unaffected.
        </div>
      )}

      {placements?.map((placement) => (
        <div
          key={placement.id}
          style={{
            fontSize: 13,
            padding: '6px 0',
            borderTop: '0.5px solid var(--border)',
            opacity: placement.revokedAt ? 0.6 : 1,
          }}
        >
          <div>
            <strong>{placement.companyName}</strong> — {placement.roleName}
            {placement.packageDisplay && <span className="text-muted"> · {placement.packageDisplay}</span>}
            <span className={`badge ${placement.revokedAt ? 'badge-gray' : 'badge-green'}`} style={{ fontSize: 10, marginLeft: 6 }}>
              {placement.revokedAt ? 'Revoked' : 'Active'}
            </span>
            <span className="badge badge-gray" style={{ fontSize: 10, marginLeft: 4 }}>
              {placement.source === 'APPLICATION' ? 'From drive' : 'Off-campus'}
            </span>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            Placed {new Date(placement.placedAt).toLocaleDateString('en-IN')}
            {placement.recordedBy ? ` · recorded by ${placement.recordedBy}` : ''}
            {placement.revokedAt &&
              ` · revoked ${new Date(placement.revokedAt).toLocaleDateString('en-IN')}${placement.revokedBy ? ` by ${placement.revokedBy}` : ''}: ${placement.revokeReason}`}
          </div>

          {!placement.revokedAt && revoking !== placement.id && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, padding: '2px 0', color: 'var(--red)' }}
              onClick={() => { setRevoking(placement.id); setReason(''); }}
            >
              Revoke (recorded by mistake)
            </button>
          )}

          {revoking === placement.id && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <input
                style={{ ...input, flex: 1, minWidth: 200 }}
                placeholder="Reason (required, kept in the record)"
                value={reason}
                maxLength={1000}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11 }}
                disabled={isPending || reason.trim().length < 5}
                onClick={() => revoke(placement.id)}
              >
                Confirm revoke
              </button>
              <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={() => setRevoking(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}

      {formOpen && (
        <div style={{ display: 'grid', gap: 12, borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
          <div className="field-row">
            <div className="field">
              <label htmlFor={`placement-company-${studentId}`}>Company *</label>
              <input
                id={`placement-company-${studentId}`}
                value={form.companyName}
                maxLength={200}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`placement-role-${studentId}`}>Role *</label>
              <input
                id={`placement-role-${studentId}`}
                value={form.roleName}
                maxLength={200}
                onChange={(e) => setForm({ ...form, roleName: e.target.value })}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor={`placement-package-${studentId}`}>Package</label>
              <input
                id={`placement-package-${studentId}`}
                placeholder="e.g. 6 LPA"
                value={form.packageDisplay}
                maxLength={100}
                onChange={(e) => setForm({ ...form, packageDisplay: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`placement-date-${studentId}`}>Placement date *</label>
              <input
                id={`placement-date-${studentId}`}
                type="date"
                value={form.placedAt}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm({ ...form, placedAt: e.target.value })}
              />
            </div>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            Recording a placement permanently excludes this student from new drives.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontSize: 11 }}
              disabled={isPending || !form.companyName.trim() || !form.roleName.trim()}
              onClick={record}
            >
              {isPending ? 'Saving…' : 'Record placement'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
