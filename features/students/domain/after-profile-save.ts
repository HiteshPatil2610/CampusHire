import { revalidatePath } from "next/cache";
import { notifyNewlyEligibleDrives } from "@/features/notifications/domain/newly-eligible-drives";

/**
 * What every student profile save does after it commits (Item 7): re-run
 * eligibility against the drives open to the student's department, tell them
 * about any drive they can now apply to (once — see `notifyNewlyEligibleDrives`),
 * and refresh the pages that list drives.
 *
 * The same path serves a student's first save after signing up: there is no
 * separate "new student" logic.
 *
 * Best-effort by design: the profile change is already saved, so a failure
 * here is logged and never reported as a failed save. The drive list itself
 * does not depend on this — it evaluates on every read.
 */
export async function afterStudentProfileSave(studentId: string): Promise<void> {
  try {
    await notifyNewlyEligibleDrives(studentId);
  } catch (error) {
    console.error("Eligibility re-check after profile save failed:", error);
  }

  try {
    revalidatePath("/student-dashboard");
    revalidatePath("/student-dashboard/drives");
  } catch {
    // Outside a request (a script or a test): nothing to revalidate.
  }
}
