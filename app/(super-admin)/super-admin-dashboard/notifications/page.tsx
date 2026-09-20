import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/auth';
import { NotificationCenter } from '@/components/notifications/notification-center';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** The Super Admin notification centre. Scoped to the signed-in user. */
export default async function NotificationsPage({ searchParams }: PageProps) {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch {
    redirect('/sign-in');
  }

  return <NotificationCenter user={user} searchParams={await searchParams} />;
}
