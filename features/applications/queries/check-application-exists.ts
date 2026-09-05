import { prisma } from "@/lib/prisma";

/**
 * Check if a student has already applied to a specific drive
 * 
 * @param studentId - Student ID
 * @param driveId - Drive ID
 * @returns true if application exists, false otherwise
 */
export async function checkApplicationExists(
  studentId: string,
  driveId: string
): Promise<boolean> {
  const existing = await prisma.driveApplication.findUnique({
    where: {
      studentId_driveId: {
        studentId,
        driveId,
      },
    },
    select: { id: true },
  });

  return existing !== null;
}
