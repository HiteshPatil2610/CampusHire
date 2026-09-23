/**
 * Recognising a department from what someone typed in a sheet: "comps",
 * "Computer Science Engineering", "COMP" and "cpmps" all mean COMP.
 *
 * A typed value is compared, case-insensitively and ignoring filler words
 * ("engineering", "dept", "B.E." …) and punctuation, with each department's
 * code, its name, and the common short forms below. A small typo (one letter
 * wrong, missing, extra or swapped) is forgiven for longer values. The value
 * is resolved against *every* department, and only a single clear winner
 * counts — so "IT" is never read as COMP, and a value equally close to two
 * departments is not guessed at.
 */

export interface DepartmentLike {
  code: string;
  name: string;
}

/** Words that say nothing about which department is meant. */
const FILLER = new Set([
  "department",
  "dept",
  "deptt",
  "of",
  "and",
  "engineering",
  "engineer",
  "engg",
  "eng",
  "be",
  "btech",
  "b",
  "e",
  "tech",
  "branch",
  "the",
]);

/**
 * Common ways each department is written, by code. Codes not listed here are
 * still matched by their own code and name.
 */
const ALIASES: Record<string, string[]> = {
  COMP: [
    "comp",
    "comps",
    "computer",
    "computers",
    "computer science",
    "computer science and engineering",
    "computer engineering",
    "cs",
    "cse",
    "co",
    "cmpn",
    "compsci",
    "comp sci",
  ],
  IT: ["it", "information technology", "information", "info tech", "infotech", "infotec"],
  EXTC: [
    "extc",
    "entc",
    "e&tc",
    "etc",
    "e and tc",
    "electronics and telecommunication",
    "electronics and telecommunications",
    "electronics telecommunication",
    "electronics and telecom",
    "electronics telecom",
    "electronic and telecommunication",
  ],
  MECH: ["mech", "mechanical", "mechanical engineering", "mechanics"],
  CHEM: ["chem", "chemical", "chemical engineering", "chemistry"],
  INSTRU: ["instru", "instrumentation", "instrumentation engineering", "inst", "instr", "instrument"],
};

/**
 * A comparable form: lower case, "&" as "and", punctuation dropped, filler
 * words removed, and the rest run together ("Computer Sci. & Engg." →
 * "computersci").
 */
export function departmentKey(value: string): string {
  const words = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const meaningful = words.filter((word) => !FILLER.has(word));
  // "B.E." alone, or only filler: keep what was typed rather than nothing.
  return (meaningful.length > 0 ? meaningful : words).join("");
}

function keysOf(department: DepartmentLike): Set<string> {
  const keys = new Set<string>();
  for (const value of [department.code, department.name, ...(ALIASES[department.code.toUpperCase()] ?? [])]) {
    const key = departmentKey(value);
    if (key) keys.add(key);
  }
  return keys;
}

/** Edits (insert, delete, substitute, swap neighbours) between two strings. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How many typos a value of this length may carry. Short codes must be exact. */
function allowedTypos(length: number): number {
  if (length < 4) return 0;
  if (length < 9) return 1;
  return 2;
}

/**
 * The department a typed value means, or null when it matches none — or is
 * as close to one department as to another.
 */
export function matchDepartment<T extends DepartmentLike>(value: string, departments: readonly T[]): T | null {
  const typed = departmentKey(value);
  if (!typed) return null;

  const candidates = departments.map((department) => ({ department, keys: keysOf(department) }));

  // An exact match wins outright.
  const exact = candidates.filter((candidate) => candidate.keys.has(typed));
  if (exact.length === 1) return exact[0].department;
  if (exact.length > 1) return null;

  // Otherwise the single closest department within the typo allowance.
  const limit = allowedTypos(typed.length);
  if (limit === 0) return null;
  let best: { department: T; distance: number } | null = null;
  let tied = false;
  for (const candidate of candidates) {
    let distance = Infinity;
    for (const key of candidate.keys) {
      if (key.length < 4) continue; // never "fix" a value into a short code
      distance = Math.min(distance, editDistance(typed, key));
    }
    if (distance > limit) continue;
    if (!best || distance < best.distance) {
      best = { department: candidate.department, distance };
      tied = false;
    } else if (distance === best.distance && candidate.department !== best.department) {
      tied = true;
    }
  }
  return best && !tied ? best.department : null;
}
