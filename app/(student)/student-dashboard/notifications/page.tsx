import { redirect } from 'next/navigation';
import { requireStudent } from '@/lib/auth';
import { NotificationCenter } from '@/components/notifications/notification-center';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** The student notification centre. Scoped to the signed-in user. */
export default async function NotificationsPage({ searchParams }: PageProps) {
  let user;
  try {
    const auth = await requireStudent();
    user = auth.user;
  } catch {
    redirect('/sign-in');
  }

  return <NotificationCenter user={user} searchParams={await searchParams} />;
}
