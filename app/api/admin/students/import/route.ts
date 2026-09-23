import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAdmin } from '@/lib/auth';
import { validateImportFile, uploadImportFile, deleteImportFile } from '@/lib/blob';
import { judgeImportFile } from '@/features/excel-import/domain/judge-import-file';
import type { ImportPreview } from '@/features/excel-import/schemas/import';

// POST /api/admin/students/import
// Accepts multipart/form-data with a 'file' field.
// Uploads the file to Blob, then parses and judges every row: which are clean
// and which are held back, and why. Writes nothing to the database — the
// commit action re-judges the stored file itself.
export async function POST(request: NextRequest) {
  try {
    let adminContext;
    try {
      adminContext = await requireDepartmentAdmin();
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { department, user } = adminContext;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileValidation = validateImportFile(file);
    if (!fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: 400 });
    }

    // Stored transiently so the commit judges the very same bytes.
    const uploadResult = await uploadImportFile(file, user.id);
    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error }, { status: 500 });
    }
    const blobUrl = uploadResult.url!;

    const judged = await judgeImportFile(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      department
    );

    if (!judged.success) {
      await deleteImportFile(blobUrl);
      return NextResponse.json({ error: judged.error }, { status: 422 });
    }

    const preview: ImportPreview = {
      ...judged.evaluation,
      fileName: file.name,
      blobUrl,
      departmentCode: department.code,
    };

    return NextResponse.json(preview);
  } catch (error) {
    console.error('Import preview error:', error);
    return NextResponse.json(
      { error: 'Unexpected error during file processing.' },
      { status: 500 }
    );
  }
}
