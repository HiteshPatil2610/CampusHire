/**
 * departmentUtils.js
 * Utility functions to manage department scoping for Department Admins.
 * Supports normalization, fuzzy matching (e.g., 'COMPS' vs 'CSE'),
 * and department-filtered student & drive selectors.
 */

export const DEPARTMENTS = [
  {
    code: 'CSE',
    label: 'Computer Engineering (COMPS / CSE)',
    short: 'COMPS / CSE',
    aliases: ['cse', 'comps', 'computer', 'computer science', 'computer engineering', 'cs', 'it/cse'],
  },
  {
    code: 'IT',
    label: 'Information Technology (IT)',
    short: 'IT',
    aliases: ['it', 'information technology', 'info tech'],
  },
  {
    code: 'ECE',
    label: 'Electronics & Communication (ECE)',
    short: 'ECE',
    aliases: ['ece', 'electronics', 'etc', 'entc', 'electronics & communication'],
  },
  {
    code: 'Mech',
    label: 'Mechanical Engineering (Mech)',
    short: 'Mechanical',
    aliases: ['mech', 'mechanical', 'mechanical engineering', 'me'],
  },
  {
    code: 'Civil',
    label: 'Civil Engineering (Civil)',
    short: 'Civil',
    aliases: ['civil', 'civil engineering', 'ce'],
  },
];

/**
 * Normalizes any department string or acronym to a canonical code ('CSE', 'IT', 'ECE', 'Mech', 'Civil').
 */
export function normalizeDept(dept) {
  if (!dept) return 'CSE';
  const clean = String(dept).trim().toLowerCase();
  for (const d of DEPARTMENTS) {
    if (d.code.toLowerCase() === clean || d.aliases.includes(clean)) {
      return d.code;
    }
  }
  // Check if contains key words
  if (clean.includes('comp') || clean.includes('cse') || clean.includes('cs')) return 'CSE';
  if (clean.includes('info') || clean.includes('it')) return 'IT';
  if (clean.includes('elect') || clean.includes('ece')) return 'ECE';
  if (clean.includes('mech')) return 'Mech';
  if (clean.includes('civil')) return 'Civil';

  return dept;
}

/**
 * Checks if a student's department matches the department admin's assigned department.
 */
export function isDeptMatch(studentDept, targetDept) {
  if (!studentDept || !targetDept) return false;
  const sNorm = normalizeDept(studentDept).toLowerCase();
  const tNorm = normalizeDept(targetDept).toLowerCase();
  if (sNorm === tNorm) return true;

  const sRaw = String(studentDept).toLowerCase().trim();
  const tRaw = String(targetDept).toLowerCase().trim();
  if (sRaw === 'all' || tRaw === 'all') return true;

  // Direct alias overlap
  for (const d of DEPARTMENTS) {
    const targetMatched = d.code.toLowerCase() === tNorm || d.aliases.includes(tRaw);
    if (targetMatched) {
      if (d.code.toLowerCase() === sNorm || d.aliases.includes(sRaw)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a drive is posted for the given department (or open to 'All').
 */
export function isDriveEligibleForDept(drive, targetDept) {
  if (!drive) return false;
  const depts = drive.departments || [];
  if (!depts || depts.length === 0) return true; // Open to all if not explicitly restricted
  if (depts.some((d) => String(d).toLowerCase() === 'all')) return true;

  return depts.some((d) => isDeptMatch(d, targetDept));
}

/**
 * Returns a display-friendly label for the department.
 */
export function getDeptDisplayLabel(dept) {
  const norm = normalizeDept(dept);
  const found = DEPARTMENTS.find((d) => d.code === norm);
  return found ? found.label : dept;
}
