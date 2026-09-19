/**
 * The accuracy and finality declaration a student accepts when applying.
 *
 * One definition, used by the application card (which renders `text`) and by
 * `applyToDrive` (which records `version` in the application's snapshot). If
 * the wording changes, bump `version`: a client still showing the old text is
 * then refused, and every snapshot says which declaration its student
 * accepted.
 */
export const APPLICATION_DECLARATION = {
  version: "2026-09-final-v1",
  text:
    "I confirm that my verified academic data and auto-filled/updated profile " +
    "details are accurate and ready for recruiter screening, and I understand " +
    "this application cannot be edited or withdrawn once submitted.",
} as const;
