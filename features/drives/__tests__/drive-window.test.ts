import { describe, it, expect } from "vitest";
import {
  DRIVE_DATE_MESSAGES,
  checkStoredWindow,
  endOfIndiaDay,
  indiaDay,
  parseDay,
  startDayChanged,
  startOfIndiaDay,
  toDayInput,
  validateDriveDates,
} from "../domain/drive-window";
import { driveFormSchema } from "../schemas/drive-form";


/**
 * A drive's dates (Items 11 and 12):
 *   Application Start Date >= today (same day valid)
 *   Application End Date   >  Application Start Date
 *   Next Stage Date        >  Application End Date
 * judged on India calendar days, by one function the forms and the server share.
 */

// 2026-09-23 10:00 India time.
const NOW = new Date("2026-09-23T04:30:00Z");
const TODAY = "2026-09-23";
const TOMORROW = "2026-09-24";

const dates = (start: string, end: string, next = "2026-12-01") => ({
  applicationStartDate: start,
  applicationDeadline: end,
  nextStageDate: next,
});

const judge = (start: string, end: string, next?: string) =>
  validateDriveDates(dates(start, end, next), { now: NOW, startNotBeforeToday: true });

const messages = (decision: ReturnType<typeof judge>) =>
  decision.ok ? [] : decision.issues.map((issue) => issue.message);

describe("validateDriveDates", () => {
  it("1. a start of today is valid", () => {
    expect(judge(TODAY, "2026-10-01").ok).toBe(true);
  });

  it("1. today means India's today, even just after midnight there", () => {
    // 00:05 on the 24th in India is still the 23rd in UTC.
    const justAfterMidnight = new Date("2026-09-23T18:35:00Z");
    expect(validateDriveDates(dates(TOMORROW, "2026-10-01"), { now: justAfterMidnight, startNotBeforeToday: true }).ok).toBe(true);
    expect(messages(validateDriveDates(dates(TODAY, "2026-10-01"), { now: justAfterMidnight, startNotBeforeToday: true }))).toEqual([
      DRIVE_DATE_MESSAGES.startInPast,
    ]);
  });

  it("2. a start of tomorrow is valid", () => {
    expect(judge(TOMORROW, "2026-10-01").ok).toBe(true);
  });

  it("refuses a start before today", () => {
    expect(messages(judge("2026-09-22", "2026-10-01"))).toEqual([DRIVE_DATE_MESSAGES.startInPast]);
  });

  it("3. refuses an end before the start", () => {
    expect(messages(judge("2026-10-05", "2026-10-01"))).toEqual([DRIVE_DATE_MESSAGES.endNotAfterStart]);
  });

  it("4. refuses an end equal to the start", () => {
    expect(messages(judge("2026-10-05", "2026-10-05"))).toEqual([DRIVE_DATE_MESSAGES.endNotAfterStart]);
  });

  it("5. accepts an end after the start, and stores the day boundaries in India time", () => {
    const decision = judge(TODAY, "2026-10-01", "2026-10-02");
    expect(decision).toEqual({
      ok: true,
      dates: {
        // 00:00 IST on the start day; 23:59:59.999 IST on the end day.
        applicationStartDate: new Date("2026-09-22T18:30:00.000Z"),
        applicationDeadline: new Date("2026-10-01T18:29:59.999Z"),
        nextStageDate: new Date("2026-10-01T18:30:00.000Z"),
      },
    });
  });

  it("refuses a next stage date on or before the application end", () => {
    expect(messages(judge(TODAY, "2026-10-01", "2026-10-01"))).toEqual([DRIVE_DATE_MESSAGES.nextStageNotAfterEnd]);
  });

  it("reports every problem at once", () => {
    expect(messages(judge("2026-09-01", "2026-08-01", "2026-07-01"))).toEqual([
      DRIVE_DATE_MESSAGES.startInPast,
      DRIVE_DATE_MESSAGES.endNotAfterStart,
      DRIVE_DATE_MESSAGES.nextStageNotAfterEnd,
    ]);
  });

  it("requires all three dates", () => {
    expect(messages(judge("", "", ""))).toEqual([
      DRIVE_DATE_MESSAGES.startRequired,
      DRIVE_DATE_MESSAGES.endRequired,
      DRIVE_DATE_MESSAGES.nextStageRequired,
    ]);
  });

  it("does not re-judge an unchanged past start on an edit", () => {
    const edit = validateDriveDates(dates("2026-09-01", "2026-10-01"), { now: NOW, startNotBeforeToday: false });
    expect(edit.ok).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    expect(messages(judge("2026-02-30", "2026-10-01"))).toContain(DRIVE_DATE_MESSAGES.startRequired);
  });
});

describe("day handling", () => {
  it("reads an older client's full timestamp as its India day", () => {
    // 20:00 UTC on the 22nd is already the 23rd in India.
    expect(parseDay("2026-09-22T20:00:00.000Z")).toBe("2026-09-23");
  });

  it("a picked day is the day the admin saw, never shifted by toISOString", () => {
    expect(toDayInput(new Date(2026, 8, 23))).toBe("2026-09-23");
  });

  it("start and end of an India day", () => {
    expect(startOfIndiaDay("2026-09-23").toISOString()).toBe("2026-09-22T18:30:00.000Z");
    expect(endOfIndiaDay("2026-09-23").toISOString()).toBe("2026-09-23T18:29:59.999Z");
    expect(indiaDay(endOfIndiaDay("2026-09-23"))).toBe("2026-09-23");
  });

  it("knows when a start is being moved", () => {
    const stored = startOfIndiaDay("2026-09-01");
    expect(startDayChanged("2026-09-01", stored)).toBe(false);
    expect(startDayChanged("2026-09-02", stored)).toBe(true);
  });
});

describe("checkStoredWindow — a department's resolved dates", () => {
  it("catches an overridden end that falls before the master's start", () => {
    expect(
      checkStoredWindow({
        applicationStartDate: startOfIndiaDay("2026-10-05"),
        applicationDeadline: endOfIndiaDay("2026-10-01"),
        nextStageDate: startOfIndiaDay("2026-10-10"),
      }).map((issue) => issue.message)
    ).toEqual([DRIVE_DATE_MESSAGES.endNotAfterStart]);
  });
});

describe("the drive form schema applies the order rules for every role", () => {
  const shared = {
    companyName: "Acme",
    roleName: "SE",
    packageOffered: 12,
    batchYears: ["2027"],
    applicationStartDate: "2026-10-05",
    applicationDeadline: "2026-10-05",
    nextStageDate: "2026-12-01",
    applyMethod: "IN_APP" as const,
    minCGPA: 7,
    maxActiveBacklogs: 0,
  };
  const department = { ...shared, selectionRounds: ["Aptitude"] };
  const central = { ...shared, departmentScope: { mode: "ALL" as const } };

  it("an end equal to the start is refused on the end field, whoever submits", () => {
    for (const result of [driveFormSchema.safeParse(department), driveFormSchema.safeParse(central)]) {
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]).toMatchObject({
          path: ["applicationDeadline"],
          message: DRIVE_DATE_MESSAGES.endNotAfterStart,
        });
      }
    }
  });
});