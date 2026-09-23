/**
 * Next stage date formatting utilities
 * 
 * These functions provide consistent date formatting across the drives UI.
 * All use real Date objects - no DEMO_TODAY or hardcoded test dates.
 */

/**
 * Format application deadline for display
 * 
 * @param deadline - Application end date date
 * @returns Formatted date string (e.g., "15 Sep 2026")
 */
export function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format next stage date for display
 * 
 * @param date - Next stage date
 * @returns Formatted date string with weekday (e.g., "Mon, 20 Sep 2026")
 */
export function formatNextStageDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format relative deadline (e.g., "3 days left" or "2 hours left")
 * 
 * @param deadline - Application end date date
 * @returns Relative time string
 */
export function formatDeadlineRelative(deadline: Date): string {
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return 'Deadline passed';
  }
  
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return '1 day left';
  }
  
  if (diffDays <= 7) {
    return `${diffDays} days left`;
  }
  
  return formatDeadline(deadline);
}

/**
 * Format a date for display in short form
 * 
 * @param date - Date to format
 * @returns Short formatted date (e.g., "15 Sep")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format time for display
 * 
 * @param date - Date with time
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
