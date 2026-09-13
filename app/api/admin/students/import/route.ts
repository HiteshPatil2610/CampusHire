import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAdmin } from '@/lib/auth';
import { validateImportFile, uploadImportFile, deleteImportFile } from '@/lib/blob';
import { parseImportFile } from '@/features/excel-import/parser/parse-import-file';
import { validateImportRows, checkDatabaseDuplicates } from '@/features/excel-import/validator/validate-rows';

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
