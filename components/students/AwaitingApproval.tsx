import { Clock, MailCheck, ShieldCheck } from 'lucide-react';

export interface AwaitingApprovalProps {
  /** Shown so the student can tell the admin which request is theirs. */
  email: string;
  departmentName?: string;
  submittedAt?: Date;
  /** Present when a department admin declined the request. */
  rejectedReason?: string | null;
}

/**
 * Shown to someone who signed up but whose details did not match any student
 * their department admin had already imported.
 *
 * They have a Clerk account and a `User` row, but deliberately no `Student`
 * record — that is only created once an admin approves, so an unapproved
 * sign-up never lands in a roster or a placement statistic.
 */
export default function AwaitingApproval({
  email,
  departmentName,
  submittedAt,
  rejectedReason,
}: AwaitingApprovalProps) {
  const isRejected = Boolean(rejectedReason);

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 520, width: '100%', padding: 28, textAlign: 'center' }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isRejected ? 'var(--red-light)' : 'var(--amber-light)',
            color: isRejected ? 'var(--red)' : 'var(--amber)',
          }}
        >
          {isRejected ? <ShieldCheck size={24} /> : <Clock size={24} />}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {isRejected
            ? 'Your access request was declined'
            : 'Waiting for admin confirmation'}
        </h1>

        <p
          className="text-secondary"
          style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}
        >
          {isRejected ? (
            rejectedReason
          ) : (
            <>
              Your details have been sent to
              {departmentName ? ` the ${departmentName} ` : ' your department '}
              placement admin for confirmation. You will get access to your
              student dashboard as soon as they approve it.
            </>
          )}
        </p>

        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 14px',
            textAlign: 'left',
            display: 'grid',
            gap: 8,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MailCheck size={14} aria-hidden style={{ color: 'var(--teal)' }} />
            <span className="text-secondary">
              Signed up as <strong>{email}</strong>
            </span>
          </div>
          {submittedAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} aria-hidden style={{ color: 'var(--text-muted)' }} />
              <span className="text-secondary">
                Requested on{' '}
                {new Date(submittedAt).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {!isRejected && (
          <p className="text-muted" style={{ fontSize: 11, marginTop: 16 }}>
            If your college already has you on its placement roster, approval is
            usually immediate — check back shortly.
          </p>
        )}
      </div>
    </div>
  );
}
