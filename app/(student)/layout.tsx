import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/shared/app-shell';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return <AppShell role="student">{children}</AppShell>;
}

