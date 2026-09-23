import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shared/app-shell';
import { redirectIfAccessRevoked } from '@/features/admin-accounts/domain/access-state';

/**
 * Notifications layout
 * 
 * Universal notifications page accessible to all authenticated users
 * Shows the appropriate sidebar based on user's role
 */
export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  
  try {
    user = await requireAuth();
  } catch {
    redirect('/sign-in');
  }

  // A revoked admin's notifications belong to the access they no longer have.
  await redirectIfAccessRevoked(user);

  // Map database role to sidebar role
  let sidebarRole: 'student' | 'admin' | 'superadmin' = 'student';
  
  if (user.role === 'SUPER_ADMIN') {
    sidebarRole = 'superadmin';
  } else if (user.role === 'DEPT_ADMIN') {
    sidebarRole = 'admin';
  }

  return <AppShell role={sidebarRole}>{children}</AppShell>;
}
