/**
 * Drive status types
 * A drive is either "open" (accepting applications) or "closed" (deadline passed)
 */
export type DriveStatus = "open" | "closed";

/**
 * Calculate drive status based on application deadline
 * 
 * IMPORTANT: Drive status is NEVER stored in the database.
 * It is always calculated dynamically from the applicationDeadline.
 * 
 * @param applicationDeadline - The deadline for applications
 * @returns "open" if deadline hasn't passed, "closed" if it has
 */
export function getDriveStatus(applicationDeadline: Date): DriveStatus {
  const now = new Date();
  return now < applicationDeadline ? "open" : "closed";
}

/**
 * Check if a drive is currently open for applications
 * 
 * @param applicationDeadline - The deadline for applications
 * @returns true if drive is open, false if closed
 */
export function isDriveOpen(applicationDeadline: Date): boolean {
  return getDriveStatus(applicationDeadline) === "open";
}

/**
 * Get days remaining until application deadline
 * 
 * @param applicationDeadline - The deadline for applications
 * @returns number of days remaining (0 if deadline passed, can be decimal)
 */
export function getDaysUntilDeadline(applicationDeadline: Date): number {
  const now = new Date();
  const deadline = new Date(applicationDeadline);
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, diffDays);
}
