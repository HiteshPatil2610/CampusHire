import { redirect } from 'next/navigation';
import { getOrCreateUser } from '@/lib/auth';
import { getStudentProfileByUserId } from '@/features/students/queries/get-profile';
import {
  calculateProfileCompletion,
} from '@/features/students/queries/profile-completion';
import StudentProfileClient from '@/components/students/profile/student-profile-client';

export const dynamic = 'force-dynamic';

export default async function StudentProfilePage() {
  const user = await getOrCreateUser();
  if (!user) redirect('/sign-in');

  const profile = await getStudentProfileByUserId(user.id);
  if (!profile) redirect('/student-dashboard');

  const completion = calculateProfileCompletion(profile);

  return <StudentProfileClient profile={profile} completion={completion} />;
}
