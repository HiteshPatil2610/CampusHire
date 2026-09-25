import { redirect } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import { getOrCreateUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { isAdminAccessRevoked } from '@/features/admin-accounts/domain/access-state';
import { getInstitutionSettings } from '@/features/settings/queries/get-settings';

export const dynamic = 'force-dynamic';

/**
 * Where a department admin whose access was revoked lands — on signing in
 * again, or on opening any admin page.
 *
 * Says plainly that access was revoked, and how to appeal. It shows nothing
 * else: not who revoked it, not the reason recorded, not the department or
 * anything in it. Only a revoked admin sees it; anyone else is sent home.
 */
export default async function AccessRevokedPage() {
  const user = await getOrCreateUser();
  if (!user) redirect('/sign-in');
  if (user.role !== 'DEPT_ADMIN' || !(await isAdminAccessRevoked(user.id))) redirect('/');

  const settings = await getInstitutionSettings().catch(() => null);
  const office = settings?.institutionName ? `${settings.institutionName} placement office` : 'placement office';
  const supportEmail = env.SUPPORT_CONTACT_EMAIL;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div className="card" style={{ maxWidth: 480, width: '100%', padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }} aria-hidden>
          🔒
        </div>
        <h1 className="page-title" style={{ fontSize: 22, margin: '0 0 10px' }}>
          Access revoked
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.5 }}>
          Your department admin access to CampusHire has been revoked by the Super Admin. You can no longer open
          the admin dashboard or make changes.
        </p>

        <div
          style={{
            fontSize: 13,
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            marginBottom: 18,
            textAlign: 'left',
          }}
        >
          <strong>Think this is a mistake?</strong>
          <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
            {supportEmail ? (
              <>
                Write to the {office} at{' '}
                <a href={`mailto:${supportEmail}?subject=${encodeURIComponent('CampusHire admin access')}`} style={{ color: 'var(--accent)' }}>
                  {supportEmail}
                </a>{' '}
                to ask for it to be reviewed.
              </>
            ) : (
              <>Contact the {office} to ask for your access to be reviewed.</>
            )}
          </div>
        </div>

        <SignOutButton redirectUrl="/">
          <button type="button" className="btn btn-primary">
            Sign out
          </button>
        </SignOutButton>
      </div>
    </main>
  );
}
