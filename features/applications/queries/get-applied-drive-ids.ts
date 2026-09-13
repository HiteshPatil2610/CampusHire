import { prisma } from '@/lib/prisma';

export async function getAppliedDriveIds(studentId: string): Promise<string[]> {
  const rows = await prisma.driveApplication.findMany({
    where: { studentId },
    select: { driveId: true },
  });
  return rows.map((row) => row.driveId);
}
