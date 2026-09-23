/**
 * How a student's identifiers are written down.
 *
 * Every path that stores or looks up an MIS number, PRN, roll number, email,
 * phone number or name goes through these, so a value typed into a sheet and
 * the same value typed into the sign-up card compare equal, and a database
 * unique constraint cannot be dodged by case or spacing.
 */

/**
 * MIS and PRN numbers: upper case, internal whitespace removed, then 3–30
 * characters of letters, digits, "-" or "/", starting with a letter or digit.
 * The same shape is enforced by a CHECK in the database.
 */
const IDENTIFIER_SHAPE = /^[A-Z0-9][A-Z0-9/-]{2,29}$/;

export function normalizeIdentifier(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, "").toUpperCase();
}

export function isValidIdentifier(normalized: string): boolean {
  return IDENTIFIER_SHAPE.test(normalized);
}

/** Roll numbers: trimmed, upper case, internal spaces removed. */
export function normalizeRollNumber(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, "").toUpperCase();
}

export function isValidRollNumber(normalized: string): boolean {
  return normalized.length >= 1 && normalized.length <= 50;
}

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * Indian mobile numbers. Spaces, dashes, dots and brackets are dropped, and a
 * +91 / 91 / 0 prefix is removed; what remains must be ten digits starting
 * 6–9. Returns the ten digits, or null when the value is not a valid number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").trim().replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Names: surrounding space trimmed and runs of whitespace collapsed. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Whether two spellings are the same name: case, full stops and spacing are
 * ignored ("A. B. Sharma" = "a b sharma"), nothing else is. Deliberately not
 * fuzzy — a near-miss name must not unlock somebody else's record.
 */
export function namesMatch(a: string, b: string): boolean {
  const key = (name: string) =>
    normalizeName(name.replace(/\./g, " ")).toLowerCase();
  return key(a) !== "" && key(a) === key(b);
}
