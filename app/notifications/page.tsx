import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * The notification centre now lives under each role's own dashboard, so it
 * carries that role's navigation. This is the old address; it forwards.
 */
export default async function NotificationsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/sign-in');
  }

  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value] as [string, string]] : []
    )
  ).toString();

  const base =
    user.role === 'SUPER_ADMIN'
      ? '/super-admin-dashboard/notifications'
      : user.role === 'DEPT_ADMIN'
        ? '/admin-dashboard/notifications'
        : '/student-dashboard/notifications';

  redirect(query ? `${base}?${query}` : base);
}
