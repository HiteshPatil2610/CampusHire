/**
 * A student's batch.
 *
 * The batch is stored as one number, the expected passout year
 * (`Student.expectedPassoutYear`, e.g. 2027). Its label — "2023-27" — is
 * derived here and nowhere else, so two screens can never disagree about
 * which cohort a student is in. Nothing stores the label.
 *
 * The label spans the programme's four years. A lateral-entry (diploma)
 * student joins in the second year but belongs to the same cohort as the
 * regular students they pass out with, so their label is the same.
 */

/** Length of the degree programme, in years. */
export const PROGRAMME_YEARS = 4;

/** Bounds on a plausible passout year. Mirrored by a CHECK in the database. */
export const MIN_PASSOUT_YEAR = 2000;
export const MAX_PASSOUT_YEAR = 2100;

export function isValidPassoutYear(year: number): boolean {
  return (
    Number.isInteger(year) && year >= MIN_PASSOUT_YEAR && year <= MAX_PASSOUT_YEAR
  );
}

/**
 * The batch label for an expected passout year: 2027 → "2023-27".
 */
export function batchLabel(expectedPassoutYear: number): string {
  const start = expectedPassoutYear - PROGRAMME_YEARS;
  return `${start}-${String(expectedPassoutYear).slice(-2)}`;
}

/** As `batchLabel`, with a dash for a student whose batch is not recorded. */
export function formatBatch(expectedPassoutYear: number | null | undefined): string {
  return expectedPassoutYear === null || expectedPassoutYear === undefined
    ? "—"
    : batchLabel(expectedPassoutYear);
}

/**
 * Passout years a person could plausibly be choosing today: from last
 * year's batch to the one that has just joined. Offered by forms; the import
 * accepts any valid year.
 */
export function selectablePassoutYears(now: Date = new Date()): number[] {
  const year = now.getFullYear();
  const years: number[] = [];
  for (let passout = year - 1; passout <= year + PROGRAMME_YEARS; passout++) {
    years.push(passout);
  }
  return years;
}

/**
 * Read a batch as someone typed it into a sheet or a form.
 *
 * Accepts the passout year alone ("2027") or the batch label, short or long
 * ("2023-27", "2023-2027", "2023 – 27"). A label must span exactly the
 * programme's length; "2023-26" is refused rather than guessed at, because
 * either end could be the typo. Returns null for anything else.
 */
export function parseBatch(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  const text = String(raw).trim();
  if (text === "") return null;

  if (/^\d{4}$/.test(text)) {
    const year = Number(text);
    return isValidPassoutYear(year) ? year : null;
  }

  const range = text.match(/^(\d{4})\s*[-–—/]\s*(\d{2}|\d{4})$/);
  if (!range) return null;

  const start = Number(range[1]);
  const endText = range[2];
  // "27" is read in the century of the start year; "2023-00" rolls over.
  let end =
    endText.length === 4
      ? Number(endText)
      : Math.floor(start / 100) * 100 + Number(endText);
  if (endText.length === 2 && end < start) end += 100;

  if (end - start !== PROGRAMME_YEARS) return null;
  return isValidPassoutYear(end) ? end : null;
}
