import { requireDepartmentAdmin } from "@/lib/auth";
import { ExcelImportClient } from "./excel-import-client";

export default async function ImportPage() {
  const { department } = await requireDepartmentAdmin();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Bulk Student Import</h1>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
            Import students into the {department.name} placement database via Excel or CSV.
          </p>
        </div>
      </div>

      <ExcelImportClient 
        departmentCode={department.code}
        departmentId={department.id}
      />
    </div>
  );
}
