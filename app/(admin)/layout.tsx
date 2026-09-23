import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shared/app-shell';
import { getOrCreateUser } from '@/lib/auth';
import { redirectIfAccessRevoked } from '@/features/admin-accounts/domain/access-state';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // An admin whose access was revoked sees the Access Revoked page instead of
  // any admin page. Every page, action and API refuses them on its own too.
  await redirectIfAccessRevoked(await getOrCreateUser());

  return <AppShell role="admin">{children}</AppShell>;
}
