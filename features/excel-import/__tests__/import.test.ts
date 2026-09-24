import { describe, it, expect, vi, beforeEach } from "vitest";
import XLSX from "xlsx";
import { parseImportFile } from "../parser/parse-import-file";
import {
  evaluateImport,
  validateRow,
  claimedIdentifiers,
} from "../validator/validate-rows";
import { errorSheetRows, ERROR_SHEET_COLUMNS } from "../validator/error-sheet";
import { commitImport } from "../actions/commit-import";
import { issueLabel, type ExistingIdentifiers, type ParsedRow } from "../schemas/import";
import { prisma } from "@/lib/prisma";
import { deleteImportFile } from "@/lib/blob";
import { requireDepartmentAdmin } from "@/lib/auth";

// The database. Mocked, so no test in this file reaches Neon.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findMany: vi.fn(), createMany: vi.fn() },
    // The other departments, which the DEPT column is also read against.
    department: {
      findMany: vi.fn(async () => [
        { code: "IT", name: "Information Technology" },
        { code: "MECH", name: "Mechanical Engineering" },
      ]),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return {
    AuthorizationError,
    requireDepartmentAdmin: vi.fn(),
  };
});

vi.mock("@/lib/audit", () => ({
  createAuditLogInTransaction: vi.fn(async () => {}),
  AuditAction: { IMPORT: "IMPORT" },
  AuditEntityType: { BULK_IMPORT: "BulkImport" },
}));

// Not `vi.importActual` for the untouched export: the real module imports
// `lib/env.ts`, which validates `process.env` at load time — something
// Vitest (unlike Next.js) never populates from `.env`, so pulling in the
// real module here made this suite's pass/fail depend on whatever the
// invoking shell happened to export. `isOwnImportFileUrl` is pure string
// logic, so it's reproduced directly instead.
vi.mock("@/lib/blob", () => ({
  isOwnImportFileUrl: (url: string, adminId: string) => {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" &&
        parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
        parsed.pathname.startsWith(`/imports/${adminId}-`)
      );
    } catch {
      return false;
    }
  },
  deleteImportFile: vi.fn(async () => {}),
}));

const DEPARTMENT = { id: "dept-1", name: "Computer Engineering", code: "COMP" };
const NOTHING_REGISTERED: ExistingIdentifiers = {
  misNumbers: new Set(),
  prnNumbers: new Set(),
  rollNumbers: new Set(),
  emails: new Set(),
};

const HEADER = ["MIS NO.", "PRN NO.", "NAME", "EMAIL", "PH. NO.", "ROLL NO.", "DEPT", "BATCH"];

/** A clean row; override any column. */
function row(rowNumber: number, overrides: Partial<ParsedRow["values"]> = {}): ParsedRow {
  return {
    rowNumber,
    values: {
      misNumber: `MIS00${rowNumber}`,
      prnNumber: `PRN00${rowNumber}`,
      name: `Student ${rowNumber}`,
      email: `student${rowNumber}@college.edu`,
      phoneNumber: `98765432${String(rowNumber).padStart(2, "0")}`,
      rollNumber: `21CS0${rowNumber}`,
      department: "COMP",
      batch: "2027",
      ...overrides,
    },
  };
}

/** Drop keys whose override is undefined — a column left empty. */
function without(values: ParsedRow["values"], ...fields: (keyof ParsedRow["values"])[]) {
  const copy = { ...values };
  for (const field of fields) delete copy[field];
  return copy;
}

function sheet(rows: string[][], bookType: XLSX.BookType = "xlsx"): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  return XLSX.write(wb, { type: "buffer", bookType }) as Buffer;
}

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

describe("import — parser", () => {
  it("reads the sheet's columns by their headers, as typed", async () => {
    const result = await parseImportFile(
      sheet([HEADER, ["mis001", "", "Aditi Sharma", "Aditi@College.edu", "+91 98765 43210", "21cs042", "COMP", "2023-27"]]),
      "students.xlsx"
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        values: {
          misNumber: "mis001",
          name: "Aditi Sharma",
          email: "Aditi@College.edu",
          phoneNumber: "+91 98765 43210",
          rollNumber: "21cs042",
          department: "COMP",
          batch: "2023-27",
        },
      },
    ]);
  });

  it("matches headers loosely and ignores unknown columns", async () => {
    const result = await parseImportFile(
      sheet([
        ["Row #", "mis_no", "prn no", "Name", "Email", "Ph No", "Roll No", "Dept", "Batch", "Error Tags"],
        ["5", "MIS1", "PRN1", "A B", "a@b.co", "9876543210", "R1", "COMP", "2027", "Invalid Email"],
      ]),
      "fixed.xlsx"
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rows[0].values).not.toHaveProperty("Row #");
    expect(result.rows[0].values.misNumber).toBe("MIS1");
  });

  it("reads CSV", async () => {
    const result = await parseImportFile(
      Buffer.from(`${HEADER.join(",")}\nMIS1,,A B,a@b.co,9876543210,R1,COMP,2027\n`),
      "students.csv"
    );
    expect(result.success).toBe(true);
  });

  it("refuses a sheet missing a required column, naming it", async () => {
    const result = await parseImportFile(
      sheet([["NAME", "EMAIL", "PH. NO.", "ROLL NO.", "DEPT", "BATCH"], ["A", "a@b.co", "9876543210", "R", "COMP", "2027"]]),
      "students.xlsx"
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("MIS NO.");
  });

  it("refuses a sheet without a PRN NO. column", async () => {
    const result = await parseImportFile(
      sheet([
        ["MIS NO.", "NAME", "EMAIL", "PH. NO.", "ROLL NO.", "DEPT", "BATCH"],
        ["MIS1", "A B", "a@b.co", "9876543210", "R1", "COMP", "2027"],
      ]),
      "students.xlsx"
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("PRN NO.");
  });

  it("refuses unsupported file types", async () => {
    const result = await parseImportFile(Buffer.from("x"), "students.pdf");
    expect(result.success).toBe(false);
  });

  it("skips fully empty rows but keeps sheet row numbers", async () => {
    const result = await parseImportFile(
      sheet([HEADER, ["MIS1", "PRN1", "A B", "a@b.co", "9876543210", "R1", "COMP", "2027"], [], ["MIS2", "", "C D", "c@d.co", "9876543211", "R2", "COMP", "2027"]]),
      "students.xlsx"
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rows.map((r) => r.rowNumber)).toEqual([2, 4]);
  });
});

describe("import — validation", () => {
  it("1. a valid row is ready, normalised", () => {
    const result = evaluateImport(
      [row(2, { misNumber: " mis 002 ", email: "Student2@College.EDU", phoneNumber: "+91 98765-43202", rollNumber: "21cs02", batch: "2023-27" })],
      DEPARTMENT,
      NOTHING_REGISTERED
    );

    expect(result.rejected).toEqual([]);
    expect(result.ready).toEqual([
      {
        rowNumber: 2,
        student: {
          misNumber: "MIS002",
          prnNumber: "PRN002",
          name: "Student 2",
          email: "student2@college.edu",
          phoneNumber: "9876543202",
          rollNumber: "21CS02",
          expectedPassoutYear: 2027,
          entryType: "REGULAR",
        },
      },
    ]);
  });

  it("PRN is required in an admin's import", () => {
    const result = evaluateImport(
      [{ rowNumber: 2, values: without(row(2).values, "prnNumber") }],
      DEPARTMENT,
      NOTHING_REGISTERED
    );
    expect(result.ready).toHaveLength(0);
    expect(result.rejected[0].issues).toEqual([
      expect.objectContaining({ tag: "MISSING_FIELD", field: "prnNumber", message: "PRN NO. is empty" }),
    ]);
  });

  it("2. a missing required field is tagged Missing Field, per column", () => {
    const { issues } = validateRow(
      { rowNumber: 2, values: without(row(2).values, "misNumber", "batch") },
      DEPARTMENT
    );
    expect(issues.filter((i) => i.tag === "MISSING_FIELD").map((i) => i.field)).toEqual([
      "misNumber",
      "batch",
    ]);
  });

  it("3. an invalid email is tagged Invalid Email", () => {
    const { issues } = validateRow(row(2, { email: "not-an-email" }), DEPARTMENT);
    expect(issues.map((i) => i.tag)).toEqual(["INVALID_EMAIL"]);
  });

  it.each(["12345", "98765432101234", "5876543210", "phone"])(
    "4. an invalid phone (%s) is tagged Invalid Phone",
    (phoneNumber) => {
      const { issues } = validateRow(row(2, { phoneNumber }), DEPARTMENT);
      expect(issues.map((i) => i.tag)).toEqual(["INVALID_PHONE"]);
    }
  );

  it("rejects malformed MIS, PRN and batch values rather than accepting them", () => {
    const { issues } = validateRow(
      row(2, { misNumber: "M!", prnNumber: "P#1", batch: "2023-26" }),
      DEPARTMENT
    );
    expect(issues.map((i) => i.tag)).toEqual(["INVALID_MIS", "INVALID_PRN", "INVALID_BATCH"]);
  });

  it("refuses a row for another department", () => {
    const { issues } = validateRow(row(2, { department: "MECH" }), DEPARTMENT);
    expect(issues.map((i) => i.tag)).toEqual(["WRONG_DEPARTMENT"]);
    // The code or the full name both count as this department.
    expect(validateRow(row(2, { department: "computer engineering" }), DEPARTMENT).issues).toEqual([]);
  });

  it("reads the department loosely — case, short forms and small typos", () => {
    for (const department of ["comps", "COMPS", "Comp", "cpmps", "Computer Science Engineering", "CSE", "computer engg."]) {
      expect(validateRow(row(2, { department }), DEPARTMENT).issues, department).toEqual([]);
    }
  });

  it("names the other department a value means, instead of guessing it is ours", () => {
    const withOthers = { ...DEPARTMENT, otherDepartments: [{ code: "IT", name: "Information Technology" }] };
    const { issues } = validateRow(row(2, { department: "Information Tech" }), withOthers);

    expect(issues.map((i) => i.tag)).toEqual(["WRONG_DEPARTMENT"]);
    expect(issues[0].message).toContain("is IT, not COMP");
    expect(validateRow(row(2, { department: "Civil" }), withOthers).issues[0].message).toContain("not a department we recognise");
  });

  it("explains what a valid mobile number is", () => {
    const { issues } = validateRow(row(2, { phoneNumber: "1234567890" }), DEPARTMENT);

    expect(issues.map((i) => i.tag)).toEqual(["INVALID_PHONE"]);
    expect(issues[0].message).toContain("starting with 6, 7, 8 or 9");
    expect(validateRow(row(2, { phoneNumber: "+91 98765 43210" }), DEPARTMENT).issues).toEqual([]);
  });

  it("5. duplicate MIS within the file marks every row that shares it", () => {
    const result = evaluateImport(
      [row(2), row(3, { misNumber: "MIS002" }), row(4)],
      DEPARTMENT,
      NOTHING_REGISTERED
    );

    expect(result.ready.map((r) => r.rowNumber)).toEqual([4]);
    expect(result.rejected.map((r) => r.rowNumber)).toEqual([2, 3]);
    const issue = result.rejected[0].issues[0];
    expect(issue).toMatchObject({ tag: "DUPLICATE_MIS", duplicateScope: "FILE" });
    expect(issue.message).toContain("row 3");
    // Case and spacing do not hide a duplicate.
    expect(
      evaluateImport([row(2), row(3, { misNumber: "mis 002" })], DEPARTMENT, NOTHING_REGISTERED).ready
    ).toEqual([]);
  });

  it("5. an MIS already registered is a DATABASE duplicate, distinct from a file one", () => {
    const result = evaluateImport([row(2)], DEPARTMENT, {
      ...NOTHING_REGISTERED,
      misNumbers: new Set(["MIS002"]),
    });

    expect(result.rejected[0].issues).toEqual([
      expect.objectContaining({ tag: "DUPLICATE_MIS", duplicateScope: "DATABASE" }),
    ]);
    expect(issueLabel(result.rejected[0].issues[0])).toBe("Duplicate MIS No. (already registered)");
  });

  it("6. duplicate PRN — in the file and in the database", () => {
    const inFile = evaluateImport([row(2), row(3, { prnNumber: "PRN002" })], DEPARTMENT, NOTHING_REGISTERED);
    expect(inFile.rejected.flatMap((r) => r.tags)).toEqual(["DUPLICATE_PRN", "DUPLICATE_PRN"]);

    const inDb = evaluateImport([row(2)], DEPARTMENT, { ...NOTHING_REGISTERED, prnNumbers: new Set(["PRN002"]) });
    expect(inDb.rejected[0].issues[0]).toMatchObject({ tag: "DUPLICATE_PRN", duplicateScope: "DATABASE" });

    // Blank PRNs are held as missing, never as duplicates of each other.
    const blanks = evaluateImport(
      [{ rowNumber: 2, values: without(row(2).values, "prnNumber") }, { rowNumber: 3, values: without(row(3).values, "prnNumber") }],
      DEPARTMENT,
      NOTHING_REGISTERED
    );
    expect(blanks.ready).toHaveLength(0);
    expect(blanks.rejected.flatMap((r) => r.tags)).toEqual(["MISSING_FIELD", "MISSING_FIELD"]);
  });

  it("7. duplicate roll number — in the file and in the database", () => {
    const inFile = evaluateImport([row(2), row(3, { rollNumber: "21cs02" })], DEPARTMENT, NOTHING_REGISTERED);
    expect(inFile.rejected.flatMap((r) => r.tags)).toEqual(["DUPLICATE_ROLL", "DUPLICATE_ROLL"]);
    expect(issueLabel(inFile.rejected[0].issues[0])).toBe("Duplicate Roll No. (in file)");

    const inDb = evaluateImport([row(2)], DEPARTMENT, { ...NOTHING_REGISTERED, rollNumbers: new Set(["21CS02"]) });
    expect(inDb.rejected[0].issues[0]).toMatchObject({ tag: "DUPLICATE_ROLL", duplicateScope: "DATABASE" });
  });

  it("duplicate email — the database column is unique too", () => {
    const inDb = evaluateImport([row(2)], DEPARTMENT, {
      ...NOTHING_REGISTERED,
      emails: new Set(["student2@college.edu"]),
    });
    expect(inDb.rejected[0].tags).toEqual(["DUPLICATE_EMAIL"]);
  });

  it("8. one row carries every problem it has, not just the first", () => {
    const result = evaluateImport(
      [
        row(2),
        {
          rowNumber: 3,
          values: {
            ...without(row(3).values, "name"),
            email: "bad",
            phoneNumber: "123",
            misNumber: "MIS002",
            rollNumber: "21CS02",
          },
        },
      ],
      DEPARTMENT,
      { ...NOTHING_REGISTERED, prnNumbers: new Set(["PRN003"]) }
    );

    const held = result.rejected.find((r) => r.rowNumber === 3)!;
    expect(held.tags).toEqual([
      "MISSING_FIELD",
      "INVALID_EMAIL",
      "INVALID_PHONE",
      "DUPLICATE_MIS",
      "DUPLICATE_ROLL",
      "DUPLICATE_PRN",
    ]);
  });

  it("9. clean rows stay importable while bad rows are held", () => {
    const result = evaluateImport(
      [row(2), row(3, { email: "broken" }), row(4), row(5, { batch: "" }), row(6)],
      DEPARTMENT,
      NOTHING_REGISTERED
    );
    expect(result.totalRows).toBe(5);
    expect(result.ready.map((r) => r.rowNumber)).toEqual([2, 4, 6]);
    expect(result.rejected.map((r) => r.rowNumber)).toEqual([3, 5]);
  });

  it("claims only the normalised values for the database lookup", () => {
    expect(claimedIdentifiers([row(2, { misNumber: " mis002 ", email: "A@B.CO" })])).toEqual({
      misNumbers: ["MIS002"],
      prnNumbers: ["PRN002"],
      rollNumbers: ["21CS02"],
      emails: ["a@b.co"],
    });
  });
});

describe("import — error sheet", () => {
  it("carries the row number, the row as typed, its tags and details", () => {
    const { rejected } = evaluateImport(
      [row(2), row(3, { email: "bad", phoneNumber: "1" })],
      DEPARTMENT,
      NOTHING_REGISTERED
    );

    const [record] = errorSheetRows(rejected);
    expect(Object.keys(record)).toEqual(ERROR_SHEET_COLUMNS);
    expect(record["Row #"]).toBe("3");
    expect(record["EMAIL"]).toBe("bad");
    expect(record["MIS NO."]).toBe("MIS003");
    expect(record["Error Tags"]).toBe("Invalid Email, Invalid Phone");
    expect(record["Error Details"]).toContain('"bad" is not a valid email address');
  });

  it("can be re-uploaded as it is once corrected", async () => {
    const { rejected } = evaluateImport([row(3, { email: "bad" })], DEPARTMENT, NOTHING_REGISTERED);
    const [record] = errorSheetRows(rejected);
    record["EMAIL"] = "fixed@college.edu";

    const reparsed = await parseImportFile(
      sheet([ERROR_SHEET_COLUMNS, ERROR_SHEET_COLUMNS.map((column) => record[column])]),
      "errors.xlsx"
    );
    expect(reparsed.success).toBe(true);
    if (!reparsed.success) return;
    expect(evaluateImport(reparsed.rows, DEPARTMENT, NOTHING_REGISTERED).ready).toHaveLength(1);
  });
});

describe("import — commit", () => {
  const BLOB_URL = "https://abc.public.blob.vercel-storage.com/imports/admin-1-1700000000000.xlsx";
  let createMany: ReturnType<typeof vi.fn>;

  function serveSheet(rows: string[][]) {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => toArrayBuffer(sheet(rows)),
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireDepartmentAdmin).mockResolvedValue({
      user: { id: "admin-1" },
      department: DEPARTMENT,
    } as never);
    vi.mocked(prisma.student.findMany).mockResolvedValue([]);
    createMany = vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: unknown) =>
      (callback as (tx: unknown) => unknown)({ student: { createMany } })) as never);
  });

  it("imports the clean rows, returns the held ones, and deletes the file", async () => {
    serveSheet([
      HEADER,
      ["MIS1", "PRN1", "A B", "a@b.co", "9876543210", "R1", "COMP", "2027"],
      ["MIS2", "PRN2", "C D", "not-an-email", "9876543211", "R2", "COMP", "2027"],
      ["MIS3", "PRN3", "E F", "e@f.co", "9876543212", "R3", "COMP", "2022-26"],
    ]);

    const result = await commitImport({ blobUrl: BLOB_URL, fileName: "students.xlsx" });

    expect(result).toMatchObject({ success: true, count: 2, departmentCode: "COMP" });
    if (!result.success) return;
    expect(result.rejected.map((r) => r.rowNumber)).toEqual([3]);

    const written = createMany.mock.calls[0][0].data;
    expect(written).toEqual([
      expect.objectContaining({ misNumber: "MIS1", expectedPassoutYear: 2027, departmentId: "dept-1", isPending: true, userId: null }),
      expect.objectContaining({ misNumber: "MIS3", expectedPassoutYear: 2026 }),
    ]);
    expect(deleteImportFile).toHaveBeenCalledWith(BLOB_URL);
  });

  it("re-checks the database at commit time, not trusting the preview", async () => {
    serveSheet([HEADER, ["MIS1", "PRN1", "A B", "a@b.co", "9876543210", "R1", "COMP", "2027"]]);
    vi.mocked(prisma.student.findMany).mockResolvedValue([
      { misNumber: "MIS1", prnNumber: null, rollNumber: "OTHER", email: "x@y.co" },
    ] as never);

    const result = await commitImport({ blobUrl: BLOB_URL, fileName: "students.xlsx" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.rejected?.[0].tags).toEqual(["DUPLICATE_MIS"]);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("writes nothing when the transaction fails", async () => {
    serveSheet([HEADER, ["MIS1", "PRN1", "A B", "a@b.co", "9876543210", "R1", "COMP", "2027"]]);
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("connection lost"));

    const result = await commitImport({ blobUrl: BLOB_URL, fileName: "students.xlsx" });

    expect(result).toEqual({
      success: false,
      error: "An unexpected error occurred during import. No records were inserted.",
    });
    // The file is kept for a retry.
    expect(deleteImportFile).not.toHaveBeenCalled();
  });

  it("refuses a file URL that is not this admin's own upload", async () => {
    global.fetch = vi.fn();
    for (const blobUrl of [
      "https://example.com/imports/admin-1-1.xlsx",
      "https://abc.public.blob.vercel-storage.com/imports/admin-2-1.xlsx",
      "https://abc.public.blob.vercel-storage.com/photos/admin-1-1.xlsx",
    ]) {
      const result = await commitImport({ blobUrl, fileName: "students.xlsx" });
      expect(result.success).toBe(false);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refuses a caller who is not an active department admin", async () => {
    const { AuthorizationError } = await import("@/lib/auth");
    vi.mocked(requireDepartmentAdmin).mockRejectedValueOnce(new AuthorizationError("Not a department admin"));
    global.fetch = vi.fn();

    const result = await commitImport({ blobUrl: BLOB_URL, fileName: "students.xlsx" });

    expect(result).toEqual({ success: false, error: "Not a department admin" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
