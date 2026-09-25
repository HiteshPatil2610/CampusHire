'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  getStudentAcademicRecord,
  type StudentAcademicRecord,
} from '@/features/students/queries/get-student-academic-record';
import { dropStudent, undoStudentDrop } from '@/features/students/actions/manage-drop';
import {
  MIN_DROP_REASON_LENGTH,
  YEAR_LEVEL_LABELS,
  alreadyDroppedMessage,
  droppedThisCycle,
  planDrop,
} from '@/features/students/domain/academic-year';
import { batchLabel, formatBatch } from '@/features/students/utils/batch';

/**
 * A student's academic standing for an admin: their year level (derived from
 * the batch and the academic cycle), batch, drop count and drop history —
 * and the two actions, Mark as Drop and Undo (within 48 hours).
 *
 * Both actions are authorized and decided on the server; the preview here is
 * the same `planDrop` the server runs, so what the admin confirms is what
 * gets written.
 */
export function StudentAcademicPanel({
  studentId,
  onChanged,
  canManage = true,
}: {
  studentId: string;
  onChanged?: () => void;
  /** Dropping is the owning department admin's action alone (Phase 9, Item
   *  21) — false hides Mark as Drop / Undo for a Super Admin's read-only view. */
  canManage?: boolean;
}) {
  const { toast } = useToast();
  const [record, setRecord] = useState<StudentAcademicRecord | null | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [dropOpen, setDropOpen] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    getStudentAcademicRecord(studentId)
      .then(setRecord)
      .catch(() => setRecord(null));
  }, [studentId]);

  useEffect(load, [load]);

  const done = (message: string) => {
    toast({ title: message });
    setReason('');
    load();
    onChanged?.();
  };

  const drop = () =>
    startTransition(async () => {
      const result = await dropStudent({ studentId, reason });
      if (result.success) {
        setDropOpen(false);
        done(`Marked as Drop — batch is now ${batchLabel(result.newPassoutYear)}`);
      } else {
        toast({ title: 'Could not record the drop', description: result.error, variant: 'destructive' });
      }
    });

  const undo = (dropId: string) =>
    startTransition(async () => {
      const result = await undoStudentDrop({ dropId, reason });
      if (result.success) {
        setUndoing(null);
        done(`Drop undone — batch restored to ${batchLabel(result.newPassoutYear)}`);
      } else {
        toast({ title: 'Could not undo the drop', description: result.error, variant: 'destructive' });
      }
    });

  if (record === undefined) {
    return <div className="card text-muted" style={{ padding: '10px 12px', fontSize: 12 }}>Loading…</div>;
  }
  if (record === null) return null;

  const preview = planDrop(record.expectedPassoutYear);
  // Once a year: the same rule the server applies before every drop.
  const droppedThisYear = droppedThisCycle(record.drops);
  // The drop in force — the one that set the student's current batch — is the
  // only one the server will undo, so it is the one offered up front.
  const undoableDrop = record.drops.find(
    (entry) => entry.undoable && entry.newPassoutYear === record.expectedPassoutYear
  );
  const deadlineText = (value: Date | string) =>
    new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const input: React.CSSProperties = { padding: '6px 8px', fontSize: 12, flex: 1, minWidth: 200 };
  const reasonOk = reason.trim().length >= MIN_DROP_REASON_LENGTH;

  return (
    <div className="card" style={{ padding: '10px 12px', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Academic standing · {record.academicYear}
        </div>
        {canManage && !dropOpen && preview.ok && !droppedThisYear && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11, color: 'var(--red)' }}
            onClick={() => { setDropOpen(true); setUndoing(null); setReason(''); }}
          >
            Mark as Drop
          </button>
        )}
      </div>

      <div style={{ fontSize: 13 }}>
        <strong>{record.yearLevel ? YEAR_LEVEL_LABELS[record.yearLevel] : 'Year not known'}</strong>
        <span className="text-muted"> · Batch {formatBatch(record.expectedPassoutYear)}</span>
        {record.expectedPassoutYear !== null && (
          <span className="text-muted"> · passing out {record.expectedPassoutYear}</span>
        )}
        <span className={`badge ${record.dropCount > 0 ? 'badge-amber' : 'badge-gray'}`} style={{ fontSize: 10, marginLeft: 8 }}>
          {record.dropCount} drop{record.dropCount === 1 ? '' : 's'}
        </span>
      </div>

      {!preview.ok && <div className="text-muted" style={{ fontSize: 11 }}>{preview.error}</div>}
      {preview.ok && droppedThisYear && (
        <div className="text-muted" style={{ fontSize: 11 }}>{alreadyDroppedMessage()}</div>
      )}

      {canManage && undoableDrop && undoing !== undoableDrop.id && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--amber-light)',
            border: '1px solid var(--amber)',
            fontSize: 12,
          }}
        >
          <span>
            Marked as Drop on {deadlineText(undoableDrop.droppedAt)}. You can undo it until{' '}
            <strong>{deadlineText(undoableDrop.undoDeadline)}</strong>.
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11 }}
            onClick={() => { setUndoing(undoableDrop.id); setDropOpen(false); setReason(''); }}
          >
            ↩ Undo drop
          </button>
        </div>
      )}

      {dropOpen && preview.ok && !droppedThisYear && (
        <div style={{ display: 'grid', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <div style={{ fontSize: 12 }}>
            {YEAR_LEVEL_LABELS[preview.plan.previousLevel]} → <strong>{YEAR_LEVEL_LABELS[preview.plan.newLevel]}</strong>
            {' · '}batch {batchLabel(preview.plan.previousPassoutYear)} → <strong>{batchLabel(preview.plan.newPassoutYear)}</strong>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            The student moves to the next batch. You can undo this for 48 hours; after that it is permanent.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input
              style={input}
              placeholder="Reason (required, kept in the record)"
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={isPending || !reasonOk} onClick={drop}>
              Confirm drop
            </button>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={() => setDropOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {record.drops.map((entry) => (
        <div
          key={entry.id}
          style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--border)', opacity: entry.undoneAt ? 0.6 : 1 }}
        >
          <div>
            <strong>Drop</strong> {YEAR_LEVEL_LABELS[entry.previousLevel]} → {YEAR_LEVEL_LABELS[entry.newLevel]}
            <span className="text-muted"> · {batchLabel(entry.previousPassoutYear)} → {batchLabel(entry.newPassoutYear)}</span>
            <span className={`badge ${entry.undoneAt ? 'badge-gray' : 'badge-amber'}`} style={{ fontSize: 10, marginLeft: 6 }}>
              {entry.undoneAt ? 'Undone' : entry.undoable ? 'Undo available' : 'Permanent'}
            </span>
          </div>
          <div className="text-muted" style={{ fontSize: 11 }}>
            {new Date(entry.droppedAt).toLocaleString('en-IN')} by {entry.droppedByName} ({entry.academicYear}): {entry.reason}
          </div>
          {entry.undoneAt && (
            <div className="text-muted" style={{ fontSize: 11 }}>
              Undone {new Date(entry.undoneAt).toLocaleString('en-IN')}
              {entry.undoneByName ? ` by ${entry.undoneByName}` : ''}: {entry.undoReason}
            </div>
          )}
          {entry.undoable && entry.id !== undoableDrop?.id && (
            <div className="text-muted" style={{ fontSize: 11 }}>
              Undo the most recent drop first — this one can be undone until {deadlineText(entry.undoDeadline)}.
            </div>
          )}
          {undoing === entry.id && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <input
                style={input}
                placeholder="Why is this drop being undone? (required)"
                value={reason}
                maxLength={1000}
                onChange={(e) => setReason(e.target.value)}
              />
              <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={isPending || !reasonOk} onClick={() => undo(entry.id)}>
                Confirm undo
              </button>
              <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={() => setUndoing(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
