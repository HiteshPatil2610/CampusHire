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

    return new NextResponse(buffer as any, {
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
