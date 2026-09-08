# CampusHire — Integration Unit FE-07: Excel/CSV Bulk Student Import

You are continuing the frontend integration of `campushire_frontend (temp)`
into the existing CampusHire Next.js project.

## Current Status

Integration units completed:

- **FE-01 — Design System & App Shell ✅**
- **FE-02 — Student Dashboard & Profile ✅**
- **FE-03 — Student Drives & Applications ✅**
- **FE-04 — Notifications Page ✅**
- **FE-05 — Admin Home & Student Roster ✅**
- **FE-06 — Drive Management (Admin) ✅**
  - Drive list, post/edit drive, applicants, announcements, reports
  - `npm run build` passes ✅

Now implement:

# FE-07 — Excel/CSV Bulk Student Import

---

# 1. CRITICAL CONTEXT — READ BEFORE ANYTHING ELSE

This unit is **different from all other FE units** in one key way:

The backend for this feature is **not yet implemented**. The backend spec
is complete (`context/specs/07-Excel_CSV_Bulk_Student.md`) and the schema
file exists (`features/excel-import/schemas/import.ts`), but the server
actions, parser, validator, and route handler are all pending.

**This unit implements both the backend AND the frontend together.**
It is the most complex unit in this integration project.

Before doing anything, read every relevant existing file:

### Existing files to read first

- `context/specs/07-Excel_CSV_Bulk_Student.md` — the full backend spec
  (comprehensive — every section is binding)
- `context/project-overview.md` — bulk import rules
- `context/architecture.md` — Blob lifecycle invariant §9:
  "A successfully-imported Excel/CSV file does not persist in Blob after
  its rows are committed — cleanup happens in the same flow as the
  successful import, not as a separate best-effort job."
- `prisma/schema.prisma` — `Student` model exact field names and types,
  `isPending`, `userId` nullable, unique constraints on `rollNumber` and `email`
- `features/excel-import/schemas/import.ts` — existing `studentRowSchema`,
  `ValidationResult`, `ValidationError`, `DuplicateError`, `ParsedRow` types
- `lib/blob.ts` — existing Blob upload helper (profile photo pattern)
- `lib/env.ts` — `BLOB_READ_WRITE_TOKEN` is optional for local dev
- `lib/auth.ts` — `requireDepartmentAdmin()` return shape
- `lib/audit.ts` — `createAuditLog()`, `AuditAction`, `AuditEntityType`
- `features/students/actions/registration.ts` — how a Student record is
  created (for comparison with bulk create)

Then read the temp frontend source:

- `campushire_frontend (temp)/src/pages/admin/ExcelUploadPage.jsx` — the
  complete UI including dropzone, file info card, validation table,
  commit flow

Do not begin implementation until you have read all of the above.

---

# 2. SCOPE OF THIS UNIT

This unit covers:

1. **npm dependency** — install `xlsx` for Excel/CSV parsing
2. **Blob helper extensions** — add upload/delete helpers for import files
3. **File upload route handler** — `app/api/admin/students/import/route.ts`
4. **Parser** — `features/excel-import/parser/parse-import-file.ts`
5. **Validator** — `features/excel-import/validator/validate-rows.ts`
6. **Template generator** — `features/excel-import/template/generate-template.ts`
7. **Preview server action** — `features/excel-import/actions/preview-import.ts`
8. **Commit server action** — `features/excel-import/actions/commit-import.ts`
9. **Excel Import page UI** — port `ExcelUploadPage.jsx`
10. **Vitest tests** — 18 tests per the spec

This unit does **NOT** implement:

- Super admin pages (FE-08)
- Audit log UI (FE-09)
- Any other features

---

# 3. INSTALL REQUIRED PACKAGE

```bash
npm install xlsx
```

`xlsx` (SheetJS) is the standard library for parsing `.xlsx` and `.csv` files
in Node.js. It is well-maintained and widely used.

After installing, run `npx tsc --noEmit` to confirm it has TypeScript types
(`@types/xlsx` may need separate install if needed — check after install).

Do NOT install any additional file-processing libraries.

---

# 4. IMPORT COLUMN CONTRACT

The exact columns the import template supports, derived from
`features/excel-import/schemas/import.ts` and the `Student` /
`StudentAcademic` Prisma models:

### Required columns (import fails if any of these are missing in a row)

| Column Header | Prisma Model | Prisma Field | Validation |
|---|---|---|---|
| `Roll Number` | `Student` | `rollNumber` | non-empty, max 50 chars, unique |
| `Full Name` | `Student` | `name` | non-empty, max 200 chars |
| `College Email` | `Student` | `email` | valid email, max 200 chars, unique |

### Optional columns (row still valid if absent — default values applied)

| Column Header | Prisma Model | Prisma Field | Validation | Default |
|---|---|---|---|---|
| `Phone Number` | `Student` | `phoneNumber` | max 15 chars | null |
| `10th Percentage` | `StudentAcademic` | `tenthPercentage` | 0–100 Float | null |
| `12th Percentage` | `StudentAcademic` | `twelfthPercentage` | 0–100 Float | null |
| `Current CGPA` | `StudentAcademic` | `currentCGPA` | 0–10 Float | null |
| `Current Semester` | `StudentAcademic` | `currentSemester` | 1–8 Int | null |
| `Active Backlogs` | `StudentAcademic` | `activeBacklogs` | 0+ Int | 0 |

### Department column — NEVER used for scope

The template may include a `Department` column for informational purposes
(so the admin can verify). It is:
- Shown in the preview table for the admin to confirm visually
- **Never used server-side to determine which department students are imported into**
- The authenticated admin's `DepartmentAdmin.departmentId` is always the
  authoritative department for every imported student

### Header normalization

Accept these case-insensitive header aliases:

| Canonical | Also Accepts |
|---|---|
| `Roll Number` | `rollno`, `roll_number`, `roll no`, `prn` |
| `Full Name` | `name`, `student name`, `student_name` |
| `College Email` | `email`, `college email`, `college_email` |
| `Phone Number` | `phone`, `mobile`, `phone_number` |
| `10th Percentage` | `10th`, `tenth`, `tenth_pct`, `10th_pct`, `10th_percentage` |
| `12th Percentage` | `12th`, `twelfth`, `twelfth_pct`, `12th_pct`, `12th_percentage` |
| `Current CGPA` | `cgpa`, `current_cgpa`, `cumulative_gpa` |
| `Current Semester` | `semester`, `current_semester`, `sem` |
| `Active Backlogs` | `backlogs`, `active_backlogs`, `backlog` |

---

# 5. BLOB HELPER EXTENSIONS

## 5.1 Add to `lib/blob.ts`

Add two new functions for import file handling:

```typescript
import { put, del } from '@vercel/blob';

// Maximum import file size: 5MB
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

// Allowed import MIME types / extensions
const ALLOWED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_IMPORT_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',  // .xls
  'text/csv',
  'application/csv',
];

/**
 * Validate an import file (Excel or CSV).
 */
export function validateImportFile(
  file: File
): { valid: boolean; error?: string } {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { valid: false, error: `File exceeds 5MB limit.` };
  }
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format. Upload .xlsx, .xls, or .csv only.`,
    };
  }
  return { valid: true };
}

/**
 * Upload an import file to Vercel Blob.
 * Returns the Blob URL reference (stored transiently).
 */
export async function uploadImportFile(
  file: File,
  adminId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      return { success: false, error: 'File storage not configured.' };
    }
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() ?? 'xlsx';
    const filename = `imports/${adminId}-${timestamp}.${ext}`;
    const blob = await put(filename, file, {
      access: 'public',
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return { success: true, url: blob.url };
  } catch (error) {
    console.error('Import file upload error:', error);
    return { success: false, error: 'Failed to upload file.' };
  }
}

/**
 * Delete an import file from Vercel Blob after successful import.
 * Called in the SAME transaction/flow as the successful commit — not
 * as a separate background job.
 */
export async function deleteImportFile(url: string): Promise<void> {
  try {
    if (!env.BLOB_READ_WRITE_TOKEN) return;
    await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch (error) {
    // Log but don't throw — Blob cleanup failure should not fail the import
    console.error('Failed to delete import Blob file:', error);
  }
}
```

---

# 6. FILE UPLOAD ROUTE HANDLER

## 6.1 Target file

`app/api/admin/students/import/route.ts` (NEW FILE)

Create directories: `app/api/admin/students/import/`

## 6.2 Why a route handler (not a server action)

File uploads via `multipart/form-data` require a route handler — server
actions do not support raw file streams reliably. This follows the same
pattern as `app/api/students/profile-photo/route.ts`.

## 6.3 Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAdmin } from '@/lib/auth';
import { validateImportFile, uploadImportFile } from '@/lib/blob';
import { parseImportFile } from '@/features/excel-import/parser/parse-import-file';
import { validateImportRows } from '@/features/excel-import/validator/validate-rows';
import { checkDatabaseDuplicates } from '@/features/excel-import/validator/validate-rows';
import { prisma } from '@/lib/prisma';

// POST /api/admin/students/import
// Accepts multipart/form-data with a 'file' field.
// Uploads file to Blob, parses it, validates rows, checks DB duplicates.
// Returns ValidationResult — does NOT insert any records.
export async function POST(request: NextRequest) {
  try {
    // 1. Auth: dept admin only
    let adminContext;
    try {
      adminContext = await requireDepartmentAdmin();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { department } = adminContext;

    // 2. Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 3. Validate file type and size
    const fileValidation = validateImportFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    // 4. Upload to Blob (transient)
    const uploadResult = await uploadImportFile(file, adminContext.user.id);
    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error }, { status: 500 });
    }
    const blobUrl = uploadResult.url!;

    // 5. Parse file from the uploaded blob
    const arrayBuffer = await file.arrayBuffer();
    const parseResult = await parseImportFile(
      Buffer.from(arrayBuffer),
      file.name
    );

    if (!parseResult.success) {
      // File unreadable — delete the blob, return error
      await deleteImportFile(blobUrl);
      return NextResponse.json(
        { error: parseResult.error },
        { status: 422 }
      );
    }

    // 6. Validate all rows
    const validationResult = validateImportRows(parseResult.rows, file.name);

    // 7. Check database duplicates (only for valid rows — no point checking invalid ones)
    if (validationResult.canImport) {
      const dbDuplicates = await checkDatabaseDuplicates(
        parseResult.rows,
        department.id
      );
      validationResult.duplicates.push(...dbDuplicates);
      if (dbDuplicates.length > 0) {
        validationResult.canImport = false;
        validationResult.invalidRows += dbDuplicates.length;
        validationResult.validRows -= dbDuplicates.length;
      }
    }

    // 8. Return validation result + blob URL (used by commit action)
    return NextResponse.json({
      ...validationResult,
      blobUrl,        // Frontend passes this to the commit action
      departmentId:   department.id,    // For display only — never trusted by commit
      departmentCode: department.code,
    });
  } catch (error) {
    console.error('Import preview error:', error);
    return NextResponse.json(
      { error: 'Unexpected error during file processing.' },
      { status: 500 }
    );
  }
}
```

---

# 7. FILE PARSER

## 7.1 Target file

`features/excel-import/parser/parse-import-file.ts` (NEW FILE)

Create directory: `features/excel-import/parser/`

## 7.2 Implementation

```typescript
import * as XLSX from 'xlsx';
import type { ParsedRow } from '../schemas/import';

// Header alias map — normalizes any recognized header to the canonical key
const HEADER_ALIASES: Record<string, string> = {
  'roll number': 'rollNumber', rollno: 'rollNumber', roll_number: 'rollNumber',
  'roll no': 'rollNumber', prn: 'rollNumber',
  'full name': 'name', name: 'name', 'student name': 'name', student_name: 'name',
  'college email': 'email', email: 'email', college_email: 'email',
  'phone number': 'phoneNumber', phone: 'phoneNumber', mobile: 'phoneNumber',
  phone_number: 'phoneNumber',
  '10th percentage': 'tenthPercentage', '10th': 'tenthPercentage',
  tenth: 'tenthPercentage', tenth_pct: 'tenthPercentage', '10th_pct': 'tenthPercentage',
  '10th_percentage': 'tenthPercentage',
  '12th percentage': 'twelfthPercentage', '12th': 'twelfthPercentage',
  twelfth: 'twelfthPercentage', twelfth_pct: 'twelfthPercentage',
  '12th_pct': 'twelfthPercentage', '12th_percentage': 'twelfthPercentage',
  'current cgpa': 'currentCGPA', cgpa: 'currentCGPA', current_cgpa: 'currentCGPA',
  cumulative_gpa: 'currentCGPA',
  'current semester': 'currentSemester', semester: 'currentSemester',
  current_semester: 'currentSemester', sem: 'currentSemester',
  'active backlogs': 'activeBacklogs', backlogs: 'activeBacklogs',
  active_backlogs: 'activeBacklogs', backlog: 'activeBacklogs',
  // Department column — read but never used for import scope
  department: 'department', dept: 'department',
};

// Required canonical keys that MUST be present in the file's header row
const REQUIRED_KEYS = ['rollNumber', 'name', 'email'] as const;

export interface ParseSuccess {
  success: true;
  rows: ParsedRow[];
  headers: string[];  // canonical header keys found
}

export interface ParseFailure {
  success: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Parse an Excel (.xlsx/.xls) or CSV (.csv) buffer into structured rows.
 * Returns row objects with camelCase keys matching studentRowSchema.
 */
export async function parseImportFile(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  try {
    const ext = filename.split('.').pop()?.toLowerCase();

    // Read the workbook
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    if (!workbook.SheetNames.length) {
      return { success: false, error: 'File contains no sheets.' };
    }

    // Use the first sheet
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',   // empty cells become empty string, not undefined
      raw: false,   // convert all values to strings first (we parse numbers ourselves)
    });

    if (rawRows.length === 0) {
      return { success: false, error: 'File is empty or has no data rows.' };
    }

    // Get raw header keys from first row, normalize them
    const rawHeaders = Object.keys(rawRows[0]);
    const headerMap: Record<string, string> = {};  // raw → canonical
    const canonicalHeaders: string[] = [];

    for (const rawHeader of rawHeaders) {
      const normalized = rawHeader.trim().toLowerCase();
      const canonical = HEADER_ALIASES[normalized];
      if (canonical) {
        headerMap[rawHeader] = canonical;
        if (!canonicalHeaders.includes(canonical)) {
          canonicalHeaders.push(canonical);
        }
      }
    }

    // Check all required columns are present
    const missingRequired = REQUIRED_KEYS.filter(k => !canonicalHeaders.includes(k));
    if (missingRequired.length > 0) {
      return {
        success: false,
        error: `Missing required columns: ${missingRequired.join(', ')}. ` +
               `Download the template for the correct format.`,
      };
    }

    // Map raw rows to canonical-keyed ParsedRow objects
    const parsedRows: ParsedRow[] = rawRows.map((rawRow, index) => {
      const mapped: Record<string, unknown> = {};
      for (const rawHeader of rawHeaders) {
        const canonical = headerMap[rawHeader];
        if (canonical) {
          const rawValue = String(rawRow[rawHeader] ?? '').trim();
          // Parse numeric fields
          if (['tenthPercentage', 'twelfthPercentage', 'currentCGPA'].includes(canonical)) {
            const n = parseFloat(rawValue);
            mapped[canonical] = isNaN(n) ? undefined : n;
          } else if (['currentSemester', 'activeBacklogs'].includes(canonical)) {
            const n = parseInt(rawValue, 10);
            mapped[canonical] = isNaN(n) ? undefined : n;
          } else {
            mapped[canonical] = rawValue || undefined;
          }
        }
      }
      return { rowNumber: index + 2, data: mapped }; // +2 because row 1 = header
    });

    // Filter completely empty rows (all values empty/undefined)
    const nonEmptyRows = parsedRows.filter(row =>
      Object.values(row.data).some(v => v !== undefined && v !== '')
    );

    return { success: true, rows: nonEmptyRows, headers: canonicalHeaders };
  } catch (error) {
    console.error('Parse error:', error);
    return {
      success: false,
      error: 'Could not read file. Ensure it is a valid .xlsx, .xls, or .csv file.',
    };
  }
}
```

---

# 8. ROW VALIDATOR

## 8.1 Target file

`features/excel-import/validator/validate-rows.ts` (NEW FILE)

Create directory: `features/excel-import/validator/`

## 8.2 Implementation

```typescript
import { prisma } from '@/lib/prisma';
import { studentRowSchema } from '../schemas/import';
import type {
  ParsedRow, ValidationResult, ValidationError, DuplicateError
} from '../schemas/import';

/**
 * Validate all parsed rows using studentRowSchema.
 * Also detects within-file duplicates (same rollNumber or email in two rows).
 * Does NOT check database duplicates — that is separate (checkDatabaseDuplicates).
 * Does NOT insert any records.
 */
export function validateImportRows(
  rows: ParsedRow[],
  fileName: string
): ValidationResult {
  const errors: ValidationError[] = [];
  const duplicates: DuplicateError[] = [];

  // Within-file duplicate tracking
  const seenRollNumbers = new Map<string, number>(); // value → first rowNumber
  const seenEmails      = new Map<string, number>();

  for (const { rowNumber, data } of rows) {
    // Zod validation
    const result = studentRowSchema.safeParse(data);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row:   rowNumber,
          field: issue.path.join('.') || 'unknown',
          value: String(data[issue.path[0]] ?? ''),
          error: issue.message,
        });
      }
    } else {
      // Check within-file duplicates only for valid rows
      const { rollNumber, email } = result.data;

      if (seenRollNumbers.has(rollNumber)) {
        duplicates.push({
          row:          rowNumber,
          field:        'rollNumber',
          value:        rollNumber,
          duplicateRow: seenRollNumbers.get(rollNumber),
        });
      } else {
        seenRollNumbers.set(rollNumber, rowNumber);
      }

      if (seenEmails.has(email)) {
        duplicates.push({
          row:          rowNumber,
          field:        'email',
          value:        email,
          duplicateRow: seenEmails.get(email),
        });
      } else {
        seenEmails.set(email, rowNumber);
      }
    }
  }

  const invalidRows   = new Set(errors.map(e => e.row)).size +
                        new Set(duplicates.map(d => d.row)).size;
  const totalRows     = rows.length;
  const validRows     = totalRows - invalidRows;

  return {
    fileName,
    totalRows,
    validRows,
    invalidRows,
    errors,
    duplicates,
    canImport: errors.length === 0 && duplicates.length === 0,
  };
}

/**
 * Check parsed rows against the database for existing rollNumber or email.
 * Called only when within-file validation passes.
 * Returns DuplicateError[] for any DB conflicts.
 */
export async function checkDatabaseDuplicates(
  rows: ParsedRow[],
  departmentId: string
): Promise<DuplicateError[]> {
  const rollNumbers = rows.map(r => String(r.data.rollNumber ?? '')).filter(Boolean);
  const emails      = rows.map(r => String(r.data.email ?? '')).filter(Boolean);

  // One query each — not one per row
  const [existingByRoll, existingByEmail] = await Promise.all([
    prisma.student.findMany({
      where: { rollNumber: { in: rollNumbers } },
      select: { rollNumber: true },
    }),
    prisma.student.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
  ]);

  const conflictRolls = new Set(existingByRoll.map(s => s.rollNumber));
  const conflictEmails = new Set(existingByEmail.map(s => s.email));

  const duplicates: DuplicateError[] = [];

  for (const { rowNumber, data } of rows) {
    const roll  = String(data.rollNumber ?? '');
    const email = String(data.email ?? '');

    if (conflictRolls.has(roll)) {
      duplicates.push({
        row:                rowNumber,
        field:              'rollNumber',
        value:              roll,
        existsInDatabase:   true,
      });
    }
    if (conflictEmails.has(email)) {
      duplicates.push({
        row:                rowNumber,
        field:              'email',
        value:              email,
        existsInDatabase:   true,
      });
    }
  }

  return duplicates;
}
```

---

# 9. TEMPLATE GENERATOR

## 9.1 Target file

`features/excel-import/template/generate-template.ts` (NEW FILE)

Create directory: `features/excel-import/template/`

## 9.2 Implementation

```typescript
import * as XLSX from 'xlsx';

/**
 * Generate a downloadable Excel template with the correct column headers
 * and 3 sample rows showing the expected format.
 * Returns a Buffer that can be sent as a file download.
 */
export function generateImportTemplate(departmentCode: string): Buffer {
  const headers = [
    'Roll Number',
    'Full Name',
    'College Email',
    'Phone Number',
    '10th Percentage',
    '12th Percentage',
    'Current CGPA',
    'Current Semester',
    'Active Backlogs',
    'Department',  // informational only — not used server-side for scope
  ];

  const sampleRows = [
    ['21CS042', 'Aditi Sharma',  'aditi.sharma@college.edu',  '9876543210', '92.4', '89.6', '8.84', '7', '0', departmentCode],
    ['21CS089', 'Rohan Mehta',   'rohan.mehta@college.edu',   '9876543211', '85.0', '82.5', '7.40', '7', '0', departmentCode],
    ['21CS104', 'Priya Patel',   'priya.patel@college.edu',   '',           '78.0', '75.0', '6.20', '7', '1', departmentCode],
  ];

  const worksheetData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths for readability
  ws['!cols'] = headers.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
```

## 9.3 Template download route handler

`app/api/admin/students/import/template/route.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAdmin } from '@/lib/auth';
import { generateImportTemplate } from '@/features/excel-import/template/generate-template';

export async function GET(request: NextRequest) {
  try {
    let adminContext;
    try {
      adminContext = await requireDepartmentAdmin();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const buffer = generateImportTemplate(adminContext.department.code);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="campushire_import_template_${adminContext.department.code}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({ error: 'Failed to generate template.' }, { status: 500 });
  }
}
```

---

# 10. COMMIT SERVER ACTION

## 10.1 Target file

`features/excel-import/actions/commit-import.ts` (NEW FILE)

Create directory: `features/excel-import/actions/`

## 10.2 Why this is a server action (not a route handler)

The commit is a mutation that inserts records — server actions are the
right tool. The file content is re-fetched from the Blob URL passed
from the preview step.

## 10.3 Implementation

```typescript
"use server";

import { prisma } from '@/lib/prisma';
import { requireDepartmentAdmin } from '@/lib/auth';
import { z } from 'zod';
import { parseImportFile } from '../parser/parse-import-file';
import { validateImportRows, checkDatabaseDuplicates } from '../validator/validate-rows';
import { deleteImportFile } from '@/lib/blob';
import { createAuditLog, AuditAction, AuditEntityType } from '@/lib/audit';
import { studentRowSchema } from '../schemas/import';

const commitInputSchema = z.object({
  blobUrl: z.string().url("Invalid blob URL"),
  fileName: z.string().min(1),
  // departmentId intentionally NOT accepted from client —
  // the server derives it from the authenticated admin
});

export type CommitImportResult =
  | { success: true; count: number; departmentCode: string }
  | { success: false; error: string; validationErrors?: unknown };

/**
 * Commit a bulk student import.
 *
 * This action INDEPENDENTLY re-validates everything server-side.
 * It does NOT trust any preview result from the client.
 *
 * Invariants:
 * - Authentication + dept scope re-checked
 * - File re-parsed from Blob
 * - All rows re-validated
 * - DB duplicates re-checked
 * - Import is atomic (Prisma transaction)
 * - Blob file deleted on success
 * - No records inserted if any row fails
 */
export async function commitImport(
  input: z.infer<typeof commitInputSchema>
): Promise<CommitImportResult> {
  try {
    // 1. Auth: dept admin only — department resolved server-side
    const { user, department } = await requireDepartmentAdmin();

    // 2. Validate input
    const validated = commitInputSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Invalid request.' };
    }
    const { blobUrl, fileName } = validated.data;

    // 3. Re-fetch file from Blob
    let buffer: Buffer;
    try {
      const response = await fetch(blobUrl);
      if (!response.ok) {
        return { success: false, error: 'Could not retrieve the uploaded file. Please re-upload.' };
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } catch {
      return { success: false, error: 'Could not retrieve the uploaded file.' };
    }

    // 4. Re-parse
    const parseResult = await parseImportFile(buffer, fileName);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // 5. Re-validate all rows
    const validationResult = validateImportRows(parseResult.rows, fileName);

    // 6. Re-check DB duplicates
    const dbDuplicates = await checkDatabaseDuplicates(parseResult.rows, department.id);
    if (dbDuplicates.length > 0) {
      validationResult.canImport = false;
      validationResult.duplicates.push(...dbDuplicates);
    }

    // 7. If any errors — abort entirely, do NOT insert anything
    if (!validationResult.canImport) {
      return {
        success: false,
        error: `Import failed: ${validationResult.invalidRows} row(s) have errors.`,
        validationErrors: {
          errors:     validationResult.errors,
          duplicates: validationResult.duplicates,
        },
      };
    }

    // 8. Parse all valid rows into Student create data
    const studentData = parseResult.rows.map(({ data }) => {
      const row = studentRowSchema.parse(data); // safe — already validated
      return {
        userId:      null,
        isPending:   true,
        departmentId: department.id,  // ALWAYS admin's own dept — never from file
        rollNumber:  row.rollNumber,
        name:        row.name,
        email:       row.email,
        phoneNumber: row.phoneNumber ?? null,
        placementStatus: "unplaced" as const,
      };
    });

    // Academic data for students that have academic fields in the file
    const academicData = parseResult.rows
      .map(({ data }) => studentRowSchema.parse(data))
      .filter(row =>
        row.tenthPercentage !== undefined ||
        row.twelfthPercentage !== undefined ||
        row.currentCGPA !== undefined ||
        row.currentSemester !== undefined ||
        row.activeBacklogs !== undefined
      );

    // 9. ATOMIC TRANSACTION — all or nothing
    const createdStudents = await prisma.$transaction(async (tx) => {
      // Create all Student records
      const students = await Promise.all(
        studentData.map(data => tx.student.create({ data }))
      );

      // Create StudentAcademic records for rows that have academic data
      for (let i = 0; i < parseResult.rows.length; i++) {
        const row = studentRowSchema.parse(parseResult.rows[i].data);
        const student = students[i];
        const hasAcademic =
          row.tenthPercentage !== undefined ||
          row.twelfthPercentage !== undefined ||
          row.currentCGPA !== undefined ||
          row.currentSemester !== undefined ||
          row.activeBacklogs !== undefined;

        if (hasAcademic) {
          await tx.studentAcademic.create({
            data: {
              studentId:          student.id,
              tenthPercentage:    row.tenthPercentage ?? 0,
              twelfthPercentage:  row.twelfthPercentage ?? 0,
              currentCGPA:        row.currentCGPA ?? 0,
              currentSemester:    row.currentSemester ?? 1,
              activeBacklogs:     row.activeBacklogs ?? 0,
            },
          });
        }
      }

      return students;
    });

    // 10. Delete Blob file — in the same flow as commit, after success
    // (not a background job — per architecture invariant §9)
    await deleteImportFile(blobUrl);

    // 11. Audit log
    await createAuditLog({
      action:     AuditAction.IMPORT,
      entityType: AuditEntityType.STUDENT,
      metadata: {
        importedCount: createdStudents.length,
        departmentId:  department.id,
        fileName,
        importedBy:    user.id,
      },
    });

    return {
      success: true,
      count: createdStudents.length,
      departmentCode: department.code,
    };
  } catch (error) {
    console.error('Commit import error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during import. No records were inserted.',
    };
  }
}
```

---

# 11. EXCEL IMPORT PAGE

## 11.1 Target file

`app/(admin)/admin-dashboard/students/import/page.tsx` — **REPLACE existing placeholder**

(The route was linked from FE-05's `AdminStudentsPage`. The page existed
as a placeholder or redirect. Replace it fully.)

## 11.2 Architecture

```
ImportPage (Server Component)
  ├── calls requireDepartmentAdmin() → { department }
  └── renders:
      ├── page header + "Download Template" button
      └── ExcelImportClient (client — "use client")
            ├── receives: departmentCode, departmentId (display only)
            └── manages: upload → preview → commit flow
```

## 11.3 Client component state machine

The client component manages a 3-state workflow:

```
State: IDLE
  → Shows dropzone
  → "Download Template" button (GET /api/admin/students/import/template)

State: PREVIEW (after file upload)
  → POST /api/admin/students/import — receives ValidationResult + blobUrl
  → Shows file info card (filename, size, row counts)
  → Shows validation table (all rows with status)
  → Shows error table if any errors
  → "Confirm & Import" button (disabled if canImport === false)
  → "Choose another file" button → back to IDLE

State: COMMITTING (after confirm click)
  → calls commitImport({ blobUrl, fileName }) server action
  → shows "Importing…" state
  → on success → shows success state + "View Students →" link
  → on failure → shows error state + validation errors
```

## 11.4 Port visual design from `ExcelUploadPage.jsx`

### Dropzone

Port the `.dropzone` CSS class with drag-and-drop behavior:

```typescript
<div
  className={`dropzone ${dragOver ? 'dragover' : ''}`}
  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
  onDragLeave={() => setDragOver(false)}
  onDrop={handleDrop}
  onClick={() => fileInputRef.current?.click()}
>
  <div style={{ fontSize: 36 }}>📊</div>
  <p style={{ marginTop: 12, fontWeight: 500, fontSize: 15 }}>
    Drag & drop your Excel or CSV file here, or click to browse
  </p>
  <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
    Supported: .xlsx, .xls, .csv (max 5 MB)
  </p>
</div>
```

### File info card

Port the card shown after upload with filename, size, row count.

### Validation results table

```typescript
// After POST /api/admin/students/import returns:
<div className="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Row</th>
        <th>Name</th>
        <th>Roll Number</th>
        <th>Email</th>
        <th>CGPA</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {previewRows.map((row) => (
        <tr key={row.rowNumber}>
          <td>#{row.rowNumber}</td>
          <td>{row.data.name ?? '—'}</td>
          <td>{row.data.rollNumber ?? '—'}</td>
          <td>{row.data.email ?? '—'}</td>
          <td>{row.data.currentCGPA ?? '—'}</td>
          <td>
            <StatusBadge variant={row.isValid ? 'green' : 'red'}>
              {row.isValid ? 'Valid' : row.errorSummary}
            </StatusBadge>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Error summary panel

Below the table, if `validationResult.errors.length > 0` or
`validationResult.duplicates.length > 0`, show a collapsed error panel:

```
⚠ Import blocked — {invalidRows} row(s) have errors

| Row | Field | Error |
|-----|-------|-------|
| 4   | email | Invalid email format |
| 8   | rollNumber | Roll number already exists in database |
```

### Summary bar and commit button

```
Ready to import: X of Y rows  [Cancel]  [Confirm & Import X Students →]
```

Disable "Confirm & Import" when `canImport === false`.
Show `disabled` state with reduced opacity.

### Success state

After successful commit:

```
✓ Import complete!
{count} students enrolled into {deptCode} department.

Students are marked as "Pending Registration" until they sign up.

[View Students →]  [Import another file]
```

"Pending Registration" students will self-register and get linked to
their Student record automatically via the existing Clerk webhook flow.

### Upload progress

While the file is being sent to `POST /api/admin/students/import`,
show a simple "Validating file…" state in place of the dropzone.
Use `useState<'idle' | 'uploading' | 'preview' | 'committing' | 'done' | 'error'>`.

## 11.5 File upload implementation

```typescript
async function handleFile(file: File) {
  setState('uploading');
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/admin/students/import', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      toast({ title: 'Upload failed', description: result.error, variant: 'destructive' });
      setState('idle');
      return;
    }

    setValidationResult(result);        // includes blobUrl
    setFileName(file.name);
    setState('preview');
  } catch {
    toast({ title: 'Upload failed', description: 'Network error. Please try again.', variant: 'destructive' });
    setState('idle');
  }
}
```

---

# 12. VITEST TESTS

## 12.1 Target file

`features/excel-import/__tests__/import.test.ts` (NEW FILE)

Create directory: `features/excel-import/__tests__/`

## 12.2 Required tests (18 tests per the spec)

Write tests using `vi.mock` for Prisma, Clerk, and Blob. All 18 tests below
must be implemented and passing:

```typescript
// 1. Valid CSV parses correctly
// 2. Valid XLSX parses correctly
// 3. Unsupported file type is rejected
// 4. Missing required column (rollNumber) is rejected with clear error
// 5. Missing required column (email) is rejected
// 6. Malformed row (invalid email format) is rejected
// 7. Invalid field value (CGPA > 10) is rejected
// 8. Duplicate rollNumber within same file is detected
// 9. Duplicate email within same file is detected
// 10. Existing database rollNumber duplicate is caught by checkDatabaseDuplicates
// 11. Existing database email duplicate is caught by checkDatabaseDuplicates
// 12. If ONE row has validation error, validateImportRows sets canImport = false
// 13. commitImport re-validates server-side (passes a mocked blobUrl)
// 14. commitImport with ANY invalid row → zero students created
// 15. commitImport with ALL valid rows → students created in prisma transaction
// 16. commitImport calls deleteImportFile after successful insert
// 17. commitImport called by unauthenticated user → returns error
// 18. commitImport called by STUDENT role → returns authorization error
```

Use `XLSX.utils.aoa_to_sheet` + `XLSX.write` to generate test buffers
inline in the tests so you don't need external fixture files.

---

# 13. NEW FILES TO CREATE

```
features/excel-import/
  ├── parser/
  │   └── parse-import-file.ts
  ├── validator/
  │   └── validate-rows.ts
  ├── template/
  │   └── generate-template.ts
  ├── actions/
  │   └── commit-import.ts
  └── __tests__/
      └── import.test.ts

app/api/admin/students/import/
  ├── route.ts                       ← preview/upload handler
  └── template/
      └── route.ts                   ← template download handler

app/(admin)/admin-dashboard/students/import/
  └── page.tsx                       ← REPLACE placeholder (the link
                                         from FE-05's "Bulk Import" button)
```

Files to **update**:

```
lib/blob.ts                          ← add validateImportFile,
                                         uploadImportFile, deleteImportFile
```

---

# 14. WHAT NOT TO DO

- Do NOT parse the file client-side and send parsed data to the server —
  the file must be uploaded as raw bytes via FormData and parsed server-side
- Do NOT trust `departmentId` from the client at any point — always use
  `requireDepartmentAdmin()` to get it server-side
- Do NOT implement the import as non-atomic (partial inserts are forbidden)
- Do NOT delete the Blob file in a background job or `setTimeout` — delete
  it synchronously in the same flow as the successful commit
- Do NOT store Excel/CSV file contents in PostgreSQL
- Do NOT create Clerk user accounts during bulk import — students are
  created with `userId: null, isPending: true`
- Do NOT invent student fields not present in `studentRowSchema`
- Do NOT use `DEMO_TODAY` or any other fake date constants
- Do NOT skip the server-side re-validation on commit — the client's
  `canImport` flag is NEVER trusted
- Do NOT implement super admin bulk import (not in V1 scope)

---

# 15. TYPESCRIPT RULES

- All files: `.ts` / `.tsx`, strict mode, no `any`
- `xlsx` types — import as `import * as XLSX from 'xlsx'`
- `ParsedRow`, `ValidationResult`, `ValidationError`, `DuplicateError` —
  all exist in `features/excel-import/schemas/import.ts` — import from there
- `studentRowSchema` — import from `features/excel-import/schemas/import.ts`
- `generateImportTemplate` returns `Buffer` — check `xlsx` Buffer type usage

---

# 16. VERIFICATION

Run in order:

```bash
npm install xlsx
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test          # all 18 new tests + all existing tests must pass
npm run build
```

Then manually verify in the browser (`npm run dev`):

### Template download
- [ ] "Download Template" button at `/admin-dashboard/students/import`
      downloads a `.xlsx` file
- [ ] Downloaded file has correct headers in row 1
- [ ] Downloaded file has 3 sample rows with dept code filled

### File upload and preview
- [ ] Drag-and-drop a valid `.xlsx` file shows the preview table
- [ ] Drag-and-drop a valid `.csv` file shows the preview table
- [ ] Uploading a `.pdf` file shows an error toast
- [ ] Uploading a file > 5MB shows an error toast
- [ ] Preview table shows all rows with correct name, roll, email
- [ ] Valid rows show green "Valid" badge
- [ ] Rows with invalid email show red badge with error message
- [ ] "Confirm & Import" button disabled when any row has errors

### Duplicate handling
- [ ] File with two identical roll numbers shows error on both rows
- [ ] File with a roll number that already exists in DB shows error
- [ ] "Confirm & Import" disabled when duplicates exist

### Commit
- [ ] With a fully valid file, "Confirm & Import" is enabled
- [ ] Clicking confirms → shows "Importing…" state
- [ ] After success: shows "Import complete! X students enrolled" message
- [ ] Students appear in student roster at `/admin-dashboard/students`
      with "Pending Registration" badge
- [ ] Only the admin's own dept students are created
- [ ] "View Students →" navigates to roster

### Security
- [ ] Attempting to POST to `/api/admin/students/import` without auth
      returns 401
- [ ] The `departmentId` shown in the preview is informational only —
      changing it in a custom request does not affect where students land

---

# 17. UPDATE PROGRESS TRACKER

After all verification passes, update `context/progress-tracker.md`:

Record:
- FE-07 complete
- `xlsx` package installed
- `lib/blob.ts` extended with import file helpers
- `parse-import-file.ts` created — supports .xlsx, .xls, .csv
- `validate-rows.ts` created — within-file + DB duplicate detection
- `generate-template.ts` + template route created
- `commit-import.ts` server action — atomic transaction, Blob cleanup
- Route handler `POST /api/admin/students/import` — preview/validation
- Excel Import page UI ported from temp frontend
- 18 Vitest tests added and passing
- All existing tests still passing
- Build passing

Set next unit: **FE-08 — Super Admin UI**

---

# 18. STRICT STOP CONDITION

When this unit is done, **STOP**.

Do NOT begin:
- Super admin pages (FE-08)
- Audit log UI (FE-09)

The next unit is **FE-08**.

---

# FINAL REPORT

When finished, provide a summary covering:

## Package
- `xlsx` version installed

## Backend
- Parser: file formats supported, header aliases implemented
- Validator: within-file vs DB duplicate detection
- Template: columns, sample data
- Commit action: transaction approach, Blob cleanup timing

## Route Handler
- Preview endpoint: what it validates, what it returns

## UI
- State machine: 6 states
- How `blobUrl` is passed from preview to commit
- Error table display

## Tests
- 18 tests: pass/fail status

## TypeScript & Build
- `tsc --noEmit` result
- `npm run lint` result
- `npm run test` result (total count)
- `npm run build` result

## Blob Lifecycle
- Confirm: Blob file deleted synchronously on successful commit
- Confirm: Failed validation leaves no student records in DB

## Scope Confirmation
Explicitly confirm:
**Department is always resolved server-side from requireDepartmentAdmin().
No Clerk accounts created during import.
Commit action re-validates independently — never trusts client preview result.
Import is atomic — zero records inserted if any row fails.**
