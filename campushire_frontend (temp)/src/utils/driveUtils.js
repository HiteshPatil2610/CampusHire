/* ============================================================
   Drive date helpers — ported from drive-data.js
   TODO(real-data): DEMO_TODAY is fixed to match the seeded mock
   dates. Once drives come from the API, delete DEMO_TODAY and use
   `new Date()` directly everywhere it's referenced below.
   ============================================================ */

export const DEMO_TODAY = new Date('2026-08-09');

export function deadlinePassed(rawDate) {
  if (!rawDate) return false;
  return new Date(rawDate) < DEMO_TODAY;
}

export function drivePassed(rawDate) {
  if (!rawDate) return false;
  return new Date(rawDate) < DEMO_TODAY;
}

export function daysUntil(rawDate) {
  if (!rawDate) return null;
  return Math.ceil((new Date(rawDate) - DEMO_TODAY) / 86400000);
}

export const BADGE_CLASS_MAP = {
  'status-open': 'badge-green',
  'status-closed': 'badge-red',
  'status-upcoming': 'badge-purple',
  'status-progress': 'badge-accent',
};
