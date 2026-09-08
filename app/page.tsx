import { auth } from '@clerk/nextjs/server';
import LandingPage from '@/components/landing/landing-page';

export const dynamic = 'force-dynamic';

interface ClerkPublicMetadata {
  role?: 'STUDENT' | 'DEPT_ADMIN' | 'SUPER_ADMIN';
}

function getDashboardHref(role?: ClerkPublicMetadata['role']): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/super-admin-dashboard';
    case 'DEPT_ADMIN':
      return '/admin-dashboard';
    default:
      return '/student-dashboard';
  }
}

export default async function Home() {
  const { userId, sessionClaims } = await auth();
  const metadata = sessionClaims?.publicMetadata as
    | ClerkPublicMetadata
    | undefined;

  return (
    <LandingPage
      isAuthenticated={Boolean(userId)}
      dashboardHref={getDashboardHref(metadata?.role)}
    />
  );
}
