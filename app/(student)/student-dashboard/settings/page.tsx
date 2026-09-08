import { redirect } from 'next/navigation';
import { getOrCreateUser } from '@/lib/auth';
import { getStudentProfileByUserId } from '@/features/students/queries/get-profile';
import SettingsClient from '@/components/students/settings/settings-client';

export const dynamic = 'force-dynamic';

export default async function StudentSettingsPage() {
  const user = await getOrCreateUser();
  if (!user) redirect('/sign-in');

  const profile = await getStudentProfileByUserId(user.id);
  if (!profile) redirect('/student-dashboard');

  return <SettingsClient />;
}
