/* ============================================================
   computeProfileCompletion — ported from shared.js
   Calculates % across 10 weighted fields. Pure function version:
   does NOT mutate state or write to storage — call
   AppState.setProfileCompletion(pct) from the caller instead.
   ============================================================ */

export function computeProfileCompletion(student) {
  let filled = 0;
  const total = 10;

  if ((student.name || '').trim()) filled++;
  if ((student.phone || '').trim()) filled++;
  if ((student.personalEmail || '').trim()) filled++;
  if ((student.address || '').trim()) filled++;
  if (student.cgpa) filled++;
  if ((student.tenth || '').trim()) filled++;
  if ((student.twelfth || '').trim()) filled++;
  if ((student.technicalSkills || []).length) filled++;
  if ((student.projects || []).length) filled++;
  if ((student.certifications || []).length) filled++;

  return Math.round((filled / total) * 100);
}
