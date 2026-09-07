import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { deadlinePassed, drivePassed } from '../../utils/driveUtils';

export default function WithdrawModal({ open, onClose, drive, onConfirm }) {
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');

  if (!open || !drive) return null;

  const isLocked = deadlinePassed(drive.driveDeadlineRaw) || drivePassed(drive.driveDateRaw);
  const finalReason = reason === 'Other' ? otherReason : reason;

  return (
    <Modal open={open} onClose={onClose} size="narrow">
      <div style={{ fontSize: 32 }}>⚠️</div>
      <h3 style={{ fontSize: 18, marginTop: 8 }}>Withdraw application?</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        You're about to withdraw your application for <strong>{drive.role}</strong> at {drive.company}.
      </p>

      {isLocked ? (
        <div className="withdraw-consequences" style={{ background: 'var(--red-light)', borderColor: 'var(--red)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--red)' }}>
            <strong>Withdrawal Locked:</strong> The deadline or drive date has already passed. Placement policy prohibits withdrawing once interview shortlisting begins. Contact the TPO cell directly.
          </p>
        </div>
      ) : (
        <>
          <div className="withdraw-consequences">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
              <li>You'll forfeit your applicant priority in this round.</li>
              <li>The placement coordinator will be notified of this withdrawal.</li>
              <li>You cannot re-apply if the deadline elapses.</li>
            </ul>
          </div>

          <div className="field" style={{ textAlign: 'left', marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500 }}>Select Reason for Withdrawal (Required)</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--border-strong)', fontSize: 13 }}
            >
              <option value="">-- Choose reason --</option>
              <option value="Accepted another job offer">Accepted another job offer</option>
              <option value="Higher studies or research offer">Pursuing higher studies / MS / MBA</option>
              <option value="Location constraint">Work location / shift mismatch</option>
              <option value="Preparation conflict">Academic / exam conflict</option>
              <option value="Other">Other reason</option>
            </select>
          </div>

          {reason === 'Other' && (
            <div className="field" style={{ textAlign: 'left', marginTop: 8 }}>
              <input
                placeholder="Briefly state your reason..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--border-strong)', fontSize: 13 }}
              />
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
        <Button variant="outline" onClick={onClose}>Keep application</Button>
        {!isLocked && (
          <Button
            variant="danger"
            disabled={!reason || (reason === 'Other' && !otherReason.trim())}
            onClick={() => onConfirm?.(drive, finalReason)}
          >
            Yes, withdraw
          </Button>
        )}
      </div>
    </Modal>
  );
}
