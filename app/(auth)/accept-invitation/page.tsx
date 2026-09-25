import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignIn, SignUp } from '@clerk/nextjs';
import { INVITATION_TTL_DAYS } from '@/features/admin-accounts/domain/invitation-policy';

export const dynamic = 'force-dynamic';

interface AcceptInvitationPageProps {
  searchParams: Promise<{ __clerk_ticket?: string; __clerk_status?: string }>;
}

const appearance = {
  variables: { borderRadius: '8px', colorPrimary: '#002147', colorBackground: '#FFFFFF' },
  elements: {
    card: { boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid var(--border)' },
    formButtonPrimary: { backgroundColor: 'var(--primary)', color: 'white', fontWeight: 500, borderRadius: '8px' },
  },
};

/**
 * Where an admin invitation link opens.
 *
 * The link carries Clerk's single-use invitation ticket. This page says what
 * the invitation is, then hands over to Clerk's sign-up, which reads the
 * ticket, verifies the email address it was sent to, and has the invitee
 * choose their own password — CampusHire never creates, sees or emails one.
 * On completion they are signed in and their role and department are applied
 * from the invitation the Super Admin issued (`applyAdminInvitation`).
 *
 * An expired, revoked or already-used ticket is refused by Clerk; without a
 * ticket there is nothing to accept, and the page says how to get a new link.
 */
export default async function AcceptInvitationPage({ searchParams }: AcceptInvitationPageProps) {
  const { userId } = await auth();
  if (userId) redirect('/');

  const params = await searchParams;
  const ticket = params.__clerk_ticket;
  // Clerk marks a ticket for an address that already has an account.
  const existingAccount = params.__clerk_status === 'sign_in';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <h1 className="page-title" style={{ fontSize: 22, margin: '0 0 6px' }}>
          Set up your CampusHire admin account
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {ticket
            ? existingAccount
              ? 'You already have an account with this email. Sign in to accept the invitation.'
              : 'You were invited as a department admin. Choose a password to finish setting up your account — you will use it with this email to sign in.'
            : `This page opens from the invitation email. Invitation links work once and for ${INVITATION_TTL_DAYS} days.`}
        </p>
      </div>

      {!ticket ? (
        <div className="card" style={{ maxWidth: 440, padding: 18, fontSize: 13, textAlign: 'center' }}>
          This link is incomplete, or it has expired or already been used. Ask your placement office to resend the
          invitation, then open the link in the new email.
        </div>
      ) : existingAccount ? (
        <SignIn routing="hash" forceRedirectUrl="/" appearance={appearance} />
      ) : (
        <SignUp routing="hash" forceRedirectUrl="/" appearance={appearance} />
      )}
    </main>
  );
}
