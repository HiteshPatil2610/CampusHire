# Unit 07 — Excel/CSV Bulk Student Import

## Purpose

Implement complete bulk student import workflow for Department Admins, allowing efficient onboarding of entire student batches with comprehensive validation, preview, and atomic transaction guarantees.

## Scope

### In Scope
- Excel (.xlsx) and CSV (.csv) file upload
- File validation (type, size, format)
- Row-by-row parsing and validation
- Duplicate detection (within file and against database)
- Preview workflow with validation results
- Atomic all-or-nothing import transaction
- Department scope enforcement (admin can only import into their department)
- Temporary file storage in Vercel Blob
- Automatic cleanup of successfully imported files
- Comprehensive error reporting with row numbers
- Template generation for downloads

### Out of Scope
- Audit logging system (will be separate module)
- Email notifications to imported students
- Automatic Clerk user creation
- Password generation for students
- Batch invitation emails
- Resume uploads in bulk import
- Photo uploads in bulk import
- Multi-department imports in single file
- Import history/reporting (future enhancement)
- Rollback of previously completed imports

## Architecture Decision: Student-User Relationship

### Current State
- Students require a `User` record (linked via `userId`)
- `User` records are created by Clerk webhook on sign-up
- Students self-register after email verification

### Bulk Import Challenge
- Imported students don't have Clerk accounts yet
- Cannot create fake Clerk IDs
- Cannot bypass authentication system

### Solution: Pending Student Records

**Bulk imported students will NOT have User records initially.**

Instead, we'll:
1. Modify schema to make `userId` **optional** on Student model
2. Add `isPending` boolean field (default: true)
3. When student is imported: create Student with `userId = null`, `isPending = true`
4. When student signs up with matching rollNumber:
   - Find pending Student record
   - Link it to newly created User
   - Set `isPending = false`
5. Pending students cannot log in (no User/Clerk account)
6. Pending students appear in admin's student roster with "Pending Registration" status

This approach:
- ✅ Respects Clerk authentication
- ✅ Avoids fake credentials
- ✅ Maintains data integrity
- ✅ Allows future self-registration to link records
- ✅ Simple and safe

## Supported File Formats

### Excel (.xlsx)
- OpenXML format
- First row must be headers
- Subsequent rows are data
- Empty rows ignored
- Maximum file size: 10MB

### CSV (.csv)
- UTF-8 encoding
- First row must be headers
- Comma-separated values
- Quoted strings supported
- Empty rows ignored
- Maximum file size: 5MB

### File Validation
- Extension check: `.xlsx` or `.csv`
- MIME type check: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `text/csv`
- File size limits enforced
- Parse-ability verification

## Import Template Columns

Based on current Student schema, the template includes:

### Required Columns
1. **rollNumber** - unique identifier (text, max 50 chars)
2. **name** - student full name (text, max 200 chars)
3. **email** - college email (email format, max 200 chars)

### Optional Columns
4. **phoneNumber** - contact number (text, max 15 chars)
5. **tenthPercentage** - 10th grade marks (number, 0-100)
6. **twelfthPercentage** - 12th grade marks (number, 0-100)
7. **currentCGPA** - current CGPA (number, 0-10)
8. **currentSemester** - current semester (integer, 1-8)
9. **activeBacklogs** - active backlogs (integer, 0+)

### Notes
- **Department is NOT in the template** - derived from authenticated admin's department
- **No User relationship fields** - students are imported as pending
- **No profile sections** (skills, projects, etc.) - students complete these after registration
- **Email is required** but only for future verification during self-registration

## Upload Workflow

```
1. Admin uploads file
   ↓
2. Upload to Vercel Blob (temporary storage)
   ↓
3. Return Blob URL to client
   ↓
4. Client triggers validation with Blob URL
   ↓
5. Server downloads from Blob URL
   ↓
6. Parse and validate all rows
   ↓
7. Return validation results (DO NOT import yet)
   ↓
8. Admin reviews results
   ↓
9. Admin confirms import
   ↓
10. Server revalidates from Blob URL
   ↓
11. Atomic transaction: create all Student records
   ↓
12. Delete Blob file on success
   ↓
13. Return success result
```

## Parsing Rules

### Header Normalization
- Case-insensitive matching
- Trim whitespace
- Support common variations:
  - "Roll Number", "roll_number", "ROLLNUMBER" → rollNumber
  - "10th Percentage", "tenth_percentage" → tenthPercentage
  - "12th Percentage", "twelfth_percentage" → twelfthPercentage
  - "CGPA", "cgpa", "Current CGPA" → currentCGPA
  - "Semester", "current_semester" → currentSemester
  - "Backlogs", "active_backlogs" → activeBacklogs
  - "Phone", "phone_number", "mobile" → phoneNumber

### Row Processing
- Skip completely empty rows
- Track original row number (1-indexed, excluding header)
- Trim whitespace from all string values
- Convert numeric strings to numbers
- Validate each field according to rules

### Error Accumulation
- Collect ALL errors per row (don't stop at first error)
- Report row number + field + specific error
- Continue validating remaining rows even if some fail

## Validation Rules

### rollNumber
- **Required**
- Max length: 50 characters
- Must be unique within file
- Must be unique in database
- Cannot be empty string after trim

### name
- **Required**
- Max length: 200 characters
- Cannot be empty string after trim

### email
- **Required**
- Valid email format
- Max length: 200 characters
- Must be unique within file
- Must be unique in database (Student.email doesn't exist yet, but we'll add it for imports)

### phoneNumber
- Optional
- Max length: 15 characters
- If provided, must not be empty after trim

### tenthPercentage
- Optional
- Number between 0 and 100 (inclusive)
- If provided, must be valid number

### twelfthPercentage
- Optional
- Number between 0 and 100 (inclusive)
- If provided, must be valid number

### currentCGPA
- Optional
- Number between 0 and 10 (inclusive)
- If provided, must be valid number

### currentSemester
- Optional
- Integer between 1 and 8 (inclusive)
- If provided, must be valid integer

### activeBacklogs
- Optional
- Integer 0 or greater
- If provided, must be valid integer
- Defaults to 0 if not provided

## Duplicate Detection

### Within-File Duplicates
- Check rollNumber uniqueness across all rows
- Check email uniqueness across all rows
- Report specific row numbers for duplicates

### Database Duplicates
- Check rollNumber against existing Student.rollNumber
- Check email against existing Student records (once email field added)
- Report as validation errors before any insertion

## Preview Results Format

```typescript
{
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number;
    field: string;
    value: string;
    error: string;
  }>;
  duplicates: Array<{
    row: number;
    field: string;
    value: string;
    duplicateRow?: number; // if within-file duplicate
    existsInDatabase?: boolean;
  }>;
  canImport: boolean; // true only if validRows > 0 and invalidRows === 0
}
```

## Import Transaction

### Atomic Guarantee
Use Prisma transaction to ensure all-or-nothing:

```typescript
await prisma.$transaction(async (tx) => {
  // Create all Student records
  // Create all StudentAcademic records (if data provided)
  // All succeed or all roll back
});
```

### Student Creation
For each valid row:
1. Create Student record:
   - `userId`: null (pending)
   - `isPending`: true
   - `departmentId`: from authenticated admin's department
   - `rollNumber`, `name`, `email`, `phoneNumber`
2. If academic data provided, create StudentAcademic record:
   - `tenthPercentage`, `twelfthPercentage`, `currentCGPA`, `currentSemester`, `activeBacklogs`

### Transaction Failure
If ANY operation fails:
- Roll back entire transaction
- NO records created
- Return error to user
- Keep Blob file for retry

## Department Scoping

### Authorization
1. Authenticate user via Clerk
2. Verify role = DEPT_ADMIN
3. Resolve DepartmentAdmin record
4. Extract department from admin.department
5. Use that department for ALL imported students

### Security
- **NEVER** accept department from file content
- **NEVER** accept department from client request
- **NEVER** allow admin to specify department parameter
- All students imported belong to admin's department ONLY

### Testing
- Verify admin A cannot import into department B
- Verify manipulated requests are rejected
- Verify department comes from auth context only

## Blob Lifecycle

### Upload Phase
1. Admin uploads file via form
2. File sent to `/api/excel-import/upload` endpoint
3. Endpoint validates file (size, type, extension)
4. Upload to Vercel Blob with path: `excel-imports/{departmentId}/{timestamp}-{filename}`
5. Return Blob URL to client
6. Store Blob URL in client state (not in database)

### Validation Phase
1. Client sends Blob URL to validation action
2. Server downloads file from Blob URL using `@vercel/blob` download
3. Parse and validate
4. Return results
5. Blob file remains in storage

### Import Phase
1. Client sends Blob URL to import action
2. Server re-downloads and re-validates
3. If valid, execute transaction
4. **On success**: delete Blob file using `@vercel/blob` delete
5. **On failure**: keep Blob file for retry

### Cleanup
- Successfully imported files: deleted immediately
- Failed imports: files remain (admin can retry)
- Failed validations: files remain (admin can fix and retry)
- Manual cleanup: admin can delete from Blob dashboard if needed

### Security
- Blob URLs are temporary (not stored in database)
- Only accessible within session
- Admin can only access their own department's uploads

## Error Handling

### File Upload Errors
- File too large: "File size must be less than {limit}MB"
- Invalid type: "Only Excel (.xlsx) and CSV (.csv) files are supported"
- Upload failure: "Failed to upload file. Please try again."

### Parsing Errors
- Cannot read file: "File is corrupted or invalid format"
- Missing headers: "File must have a header row"
- Missing required columns: "Missing required columns: {columns}"
- No data rows: "File contains no data rows"

### Validation Errors
- Per-row, per-field errors with specific messages
- Example: "Row 5, rollNumber: Roll number already exists"
- Example: "Row 12, email: Invalid email format"

### Import Errors
- Transaction failure: "Import failed. Please try again."
- Database constraint: "Database error occurred. No records were imported."
- Blob deletion failure: logged but don't fail import

### Safe Error Messages
- No SQL exposed
- No stack traces shown to user
- No Blob credentials exposed
- No internal paths shown

## Pagination

### Validation Results
- If more than 100 error rows, paginate error display
- Show first 100 errors with "Show more" option
- Client-side pagination sufficient (errors already loaded)

### Import History
- Out of scope for Unit 07
- Future enhancement: track completed imports

## Authorization Tests

1. ✅ Only DEPT_ADMIN can upload files
2. ✅ Only DEPT_ADMIN can validate imports
3. ✅ Only DEPT_ADMIN can execute imports
4. ✅ STUDENT cannot access import functionality
5. ✅ SUPER_ADMIN import behavior: defer to future (no auto-grant)
6. ✅ Unauthenticated users rejected
7. ✅ Admin can only import into their own department
8. ✅ Manipulated department ID rejected
9. ✅ Client-provided department ignored

## Validation Tests

1. ✅ Valid Excel file parses correctly
2. ✅ Valid CSV file parses correctly
3. ✅ Invalid file type rejected
4. ✅ File too large rejected
5. ✅ Missing required column rejected
6. ✅ Missing required field value rejected
7. ✅ Invalid email format rejected
8. ✅ CGPA out of range rejected
9. ✅ Duplicate rollNumber in file detected
10. ✅ Duplicate email in file detected
11. ✅ Existing rollNumber in database detected
12. ✅ All errors collected (not just first)

## Transaction Tests

1. ✅ Valid rows imported successfully
2. ✅ If one row invalid, NO rows imported
3. ✅ Database transaction rolls back on failure
4. ✅ Partial import never occurs
5. ✅ Successfully imported file deleted from Blob
6. ✅ Failed import keeps Blob file

## Security Tests

1. ✅ Department derived from auth context only
2. ✅ Cannot import into another department
3. ✅ File content cannot override department
4. ✅ Client request cannot override department
5. ✅ Preview results cannot be trusted (revalidation required)
6. ✅ Blob URLs cannot be forged

## Schema Changes Required

Add to Student model:
```prisma
model Student {
  // ... existing fields ...
  userId          String?  // Make optional (was required)
  email           String   @unique  // Add for bulk import matching
  isPending       Boolean  @default(true)  // Track pending vs registered
  // ... rest of fields ...
}
```

Migration will:
1. Make `userId` optional
2. Add `email` field (unique)
3. Add `isPending` field (default true)
4. Update existing students: set `isPending = false` where `userId IS NOT NULL`
5. Backfill email from User.email where possible

## UI Components

### Import Page (`/admin-dashboard/import-students`)

**Layout:**
- Page title: "Import Students"
- Subtitle: "Upload an Excel or CSV file to add multiple students at once"

**Upload Section:**
- File dropzone with icon
- Supported formats: ".xlsx, .csv"
- File size limit displayed
- Drag-and-drop or click to browse
- Loading state during upload

**Template Download:**
- "Download Template" button
- Generates Excel template with headers and sample row
- Includes instructions in first row (commented)

**Validation Results Section (after upload):**
- File name display
- Total rows count
- Valid rows count (green)
- Invalid rows count (red)
- Error table with columns: Row #, Field, Value, Error
- Duplicate table with columns: Row #, Field, Value, Issue
- "Fix and Re-upload" button if errors exist
- "Import {n} Students" button if valid

**Import Confirmation:**
- Loading state during import
- Success message with count
- Error message if import fails
- "Import Another File" button after completion

**States:**
- Empty: Upload form only
- Uploading: Progress indicator
- Validating: Validation spinner
- Results: Show validation results
- Importing: Import progress
- Success: Success message
- Error: Error message with details

## Performance Considerations

### File Size Limits
- Excel: 10MB max (~50,000 rows practical limit)
- CSV: 5MB max (~25,000 rows practical limit)

### Parsing
- Stream-based parsing for large files
- Don't load entire file into memory at once
- Use libraries with streaming support

### Database
- Batch insert using Prisma transactions
- Don't execute N individual queries
- Use single transaction for atomicity

### Blob Storage
- Temporary files auto-expire after 7 days
- Manual cleanup on success
- Keep failed uploads for debugging

## Libraries

### Excel Parsing
- `xlsx` (SheetJS) - industry standard, well-maintained

### CSV Parsing
- `csv-parse` - streaming support, RFC 4180 compliant

### File Upload
- `@vercel/blob` - already used for profile photos

### Validation
- `zod` - already used throughout project

## Open Questions

1. **Email uniqueness**: Should email be unique across all students or per department?
   - **Decision**: Unique across all students (institution-wide)

2. **Duplicate handling**: Should we support "upsert" mode (update existing)?
   - **Decision**: No, V1 only supports fresh imports. Duplicates are errors.

3. **Partial profiles**: Can students update their bulk-imported data?
   - **Decision**: Yes, after registration they own their profile fully

4. **Template variations**: Support multiple template versions?
   - **Decision**: Single template version for V1

5. **Maximum rows**: What's the practical upper limit?
   - **Decision**: 1000 rows per file for V1 (covers typical batch size)

6. **Import history**: Track who imported which students when?
   - **Decision**: Deferred to audit logging module

## Success Criteria

- [ ] Department admin can download template
- [ ] Department admin can upload Excel file
- [ ] Department admin can upload CSV file
- [ ] Invalid files rejected with clear errors
- [ ] Validation shows all errors before import
- [ ] Import is atomic (all or nothing)
- [ ] Successfully imported file deleted from Blob
- [ ] Department scope enforced server-side
- [ ] Cannot import into another department
- [ ] Pending students appear in admin roster
- [ ] All tests pass (authorization, validation, transaction, security)
- [ ] TypeScript passes
- [ ] ESLint passes
- [ ] Build passes
