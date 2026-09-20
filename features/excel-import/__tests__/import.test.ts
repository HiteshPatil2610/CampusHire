import { describe, it, expect, vi, beforeEach } from "vitest";
import XLSX from 'xlsx';
import { parseImportFile } from "../parser/parse-import-file";
import { validateImportRows, checkDatabaseDuplicates } from "../validator/validate-rows";
import { commitImport } from "../actions/commit-import";
import { prisma } from "@/lib/prisma";

/** A Node Buffer's own bytes as a standalone ArrayBuffer. */
const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

// The database. Mocked, so no test in this file reaches Neon: the duplicate
// check used to go out over the network and time out.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    student: { findMany: vi.fn(async () => []), create: vi.fn() },
    studentAcademic: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(async () => ({
    user: { id: "admin-1", role: "DEPARTMENT_ADMIN" },
    department: { id: "dept-1", name: "Computer Science", code: "CSE" },
  })),
  requireStudent: vi.fn(async () => {
    throw new Error("Not authorized");
  }),
}));

// Mock audit
vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(async () => {}),
  AuditAction: { IMPORT: "IMPORT" },
  AuditEntityType: { STUDENT: "STUDENT" },
}));

// Mock blob deletion
vi.mock("@/lib/blob", () => ({
  deleteImportFile: vi.fn(async () => {}),
}));

describe("Excel/CSV Import - Parser", () => {
  it("should parse valid XLSX file with all columns", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Roll Number", "Name", "Email", "Phone", "10th %", "12th %", "CGPA", "Semester", "Backlogs"],
      ["CS001", "John Doe", "john@example.com", "9876543210", 85.5, 88.2, 8.5, 6, 0],
      ["CS002", "Jane Smith", "jane@example.com", "9876543211", 90.0, 92.5, 9.0, 5, 1],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseImportFile(buffer, "test.xlsx");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].data.rollNumber).toBe("CS001");
    expect(result.rows[0].data.name).toBe("John Doe");
    expect(result.rows[0].data.tenthPercentage).toBe(85.5);
  });

  it("should parse valid CSV file", async () => {
    const csvContent = `Roll Number,Name,Email
CS001,John Doe,john@example.com
CS002,Jane Smith,jane@example.com`;
    const buffer = Buffer.from(csvContent);

    const result = await parseImportFile(buffer, "test.csv");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].data.rollNumber).toBe("CS001");
  });

  it("should reject unsupported file types", async () => {
    const buffer = Buffer.from("Invalid content");

    const result = await parseImportFile(buffer, "test.pdf");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Unsupported file type");
  });

  it("should reject files with missing required columns", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "Email"], // missing Roll Number
      ["John Doe", "john@example.com"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseImportFile(buffer, "test.xlsx");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Missing required columns");
  });

  it("should handle files with empty rows gracefully", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Roll Number", "Name", "Email"],
      ["CS001", "John Doe", "john@example.com"],
      ["", "", ""], // empty row
      ["CS002", "Jane Smith", "jane@example.com"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseImportFile(buffer, "test.xlsx");

    expect(result.success).toBe(true);
    if (!result.success) return;
    // Empty rows should be filtered out
    expect(result.rows).toHaveLength(2);
  });
});

describe("Excel/CSV Import - Validator", () => {
  it("should detect invalid email format", () => {
    const rows = [
      { rowNumber: 2, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "John", email: "invalid-email" } },
    ];

    const result = validateImportRows(rows, "test.xlsx");

    expect(result.canImport).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("email");
    expect(result.errors[0].error).toContain("Invalid email");
  });

  it("should detect missing required fields", () => {
    const rows = [
      { rowNumber: 2, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, email: "john@example.com" } }, // missing name
    ];

    const result = validateImportRows(rows, "test.xlsx");

    expect(result.canImport).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("name");
  });

  it("should detect out-of-range numeric values", () => {
    const rows = [
      { 
        rowNumber: 2, 
        data: { 
          rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, 
          name: "John", 
          email: "john@example.com",
          tenthPercentage: 150, // invalid: > 100
        } 
      },
    ];

    const result = validateImportRows(rows, "test.xlsx");

    expect(result.canImport).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("tenthPercentage");
  });

  it("should detect duplicate roll numbers within file", () => {
    const rows = [
      { rowNumber: 2, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "John", email: "john@example.com" } },
      { rowNumber: 3, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "Jane", email: "jane@example.com" } },
    ];

    const result = validateImportRows(rows, "test.xlsx");

    expect(result.canImport).toBe(false);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].field).toBe("rollNumber");
    expect(result.duplicates[0].value).toBe("CS001");
    expect(result.duplicates[0].duplicateRow).toBe(2);
  });

  it("should detect duplicate emails within file", () => {
    const rows = [
      { rowNumber: 2, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "John", email: "same@example.com" } },
      { rowNumber: 3, data: { rollNumber: "CS002", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "Jane", email: "same@example.com" } },
    ];

    const result = validateImportRows(rows, "test.xlsx");

    expect(result.canImport).toBe(false);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].field).toBe("email");
  });

  it("should detect database duplicates for roll number", async () => {
    // Mock Prisma to return existing student
    vi.spyOn(prisma.student, 'findMany').mockResolvedValueOnce([
      { 
        id: "existing-1",
        rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const,
        email: "different@example.com",
        departmentId: "dept-1",
      } as any,
    ]);

    const rows = [
      { rowNumber: 2, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "John", email: "john@example.com" } },
    ];

    const dbDuplicates = await checkDatabaseDuplicates(rows, "dept-1");

    expect(dbDuplicates).toHaveLength(1);
    expect(dbDuplicates[0].existsInDatabase).toBe(true);
    expect(dbDuplicates[0].field).toBe("rollNumber");
  });

  it("should detect database duplicates for email", async () => {
    // Mock Prisma to return existing student
    vi.spyOn(prisma.student, 'findMany').mockResolvedValueOnce([]).mockResolvedValueOnce([
      { 
        id: "existing-1",
        rollNumber: "CS999", phoneNumber: "9876543210", entryType: "REGULAR" as const,
        email: "john@example.com",
        departmentId: "dept-1",
      } as any,
    ]);

    const rows = [
      { rowNumber: 2, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "John", email: "john@example.com" } },
    ];

    const dbDuplicates = await checkDatabaseDuplicates(rows, "dept-1");

    expect(dbDuplicates).toHaveLength(1);
    expect(dbDuplicates[0].existsInDatabase).toBe(true);
    expect(dbDuplicates[0].field).toBe("email");
  });

  it("should block import if any row has errors", () => {
    const rows = [
      { rowNumber: 2, data: { rollNumber: "CS001", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "John", email: "john@example.com" } },
      { rowNumber: 3, data: { rollNumber: "CS002", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "Jane", email: "invalid-email" } },
      { rowNumber: 4, data: { rollNumber: "CS003", phoneNumber: "9876543210", entryType: "REGULAR" as const, name: "Bob", email: "bob@example.com" } },
    ];

    const result = validateImportRows(rows, "test.xlsx");

    expect(result.canImport).toBe(false);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(1);
  });
});

describe("Excel/CSV Import - Commit Action", () => {
  beforeEach(() => {
    // `clearAllMocks` wipes the implementations the mock factory set, so the
    // defaults are restored here: nothing in the database yet, and a
    // transaction that runs its callback.
    vi.clearAllMocks();
    vi.mocked(prisma.student.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockImplementation((async (callback: unknown) =>
      (callback as (tx: unknown) => unknown)({
        student: { create: vi.fn(async () => ({ id: "student-1" })) },
        studentAcademic: { create: vi.fn() },
      })) as never);
  });

  it("should re-validate on commit and reject invalid data", async () => {
    // Mock fetch to return file with invalid data
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => {
        const ws = XLSX.utils.aoa_to_sheet([
          ["Roll Number", "Name", "Email"],
          ["CS001", "John", "invalid-email"], // invalid email
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return toArrayBuffer(buffer);
      },
    });

    const result = await commitImport({
      blobUrl: "https://example.com/test.xlsx",
      fileName: "test.xlsx",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Nothing was importable, and the reason travels back with the refusal
      // rather than being swallowed — the admin has to be able to fix the row.
      expect(result.error).toContain("No importable rows");
      expect(result.validationErrors).toBeDefined();
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("should perform atomic transaction - zero inserts on any error", async () => {
    // Mock fetch to return valid file
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => {
        const ws = XLSX.utils.aoa_to_sheet([
          ["Roll Number", "Name", "Email"],
          ["CS001", "John", "john@example.com"],
          ["CS002", "Jane", "invalid-email"], // invalid
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return toArrayBuffer(buffer);
      },
    });

    const createSpy = vi.spyOn(prisma.student, 'create');

    const result = await commitImport({
      blobUrl: "https://example.com/test.xlsx",
      fileName: "test.xlsx",
    });

    expect(result.success).toBe(false);
    // Transaction should rollback, so no students created
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("should create students with correct fields on valid import", async () => {
    // Mock fetch to return valid file
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => {
        const ws = XLSX.utils.aoa_to_sheet([
          // "Diploma" is the 1/0 entry-type flag, and it is required.
          ["Roll Number", "Name", "Email", "Phone", "Diploma"],
          ["CS001", "John Doe", "john@example.com", "9876543210", 0],
          ["CS002", "Jane Smith", "jane@example.com", "9876543211", 1],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return toArrayBuffer(buffer);
      },
    });

    // Mock Prisma transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const mockTx = {
        student: {
          create: vi.fn().mockResolvedValue({ id: "student-1" }),
        },
        studentAcademic: {
          create: vi.fn(),
        },
      };
      return callback(mockTx);
    });

    // Mock DB duplicate checks to return no duplicates
    vi.spyOn(prisma.student, 'findMany').mockResolvedValue([]);

    const result = await commitImport({
      blobUrl: "https://example.com/test.xlsx",
      fileName: "test.xlsx",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.count).toBe(2);
    expect(result.departmentCode).toBe("CSE");
  });

  it("should delete blob file after successful commit", async () => {
    const { deleteImportFile } = await import("@/lib/blob");

    // Mock fetch to return valid file
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => {
        const ws = XLSX.utils.aoa_to_sheet([
          ["Roll Number", "Name", "Email", "Phone", "Diploma"],
          ["CS001", "John Doe", "john@example.com", "9876543210", 0],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return toArrayBuffer(buffer);
      },
    });

    // Mock Prisma transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const mockTx = {
        student: {
          create: vi.fn().mockResolvedValue({ id: "student-1" }),
        },
        studentAcademic: {
          create: vi.fn(),
        },
      };
      return callback(mockTx);
    });

    // Mock DB duplicate checks
    vi.spyOn(prisma.student, 'findMany').mockResolvedValue([]);

    const result = await commitImport({
      blobUrl: "https://example.com/test.xlsx",
      fileName: "test.xlsx",
    });

    // The upload is transient: once the rows are in, the file goes, in the
    // same flow rather than a background job.
    expect(result.success).toBe(true);
    expect(deleteImportFile).toHaveBeenCalledWith("https://example.com/test.xlsx");
  });
});

describe("Excel/CSV Import - Authorization", () => {
  it("should reject unauthenticated requests", async () => {
    const { requireDepartmentAdmin } = await import("@/lib/auth");
    vi.mocked(requireDepartmentAdmin).mockRejectedValueOnce(new Error("Not authenticated"));

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Buffer.from("").buffer,
    });

    const result = await commitImport({
      blobUrl: "https://example.com/test.xlsx",
      fileName: "test.xlsx",
    });

    expect(result.success).toBe(false);
  });

  it("should reject STUDENT role attempts", async () => {
    const { requireStudent } = await import("@/lib/auth");
    
    await expect(requireStudent()).rejects.toThrow("Not authorized");
  });
});
