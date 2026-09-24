import { requireSuperAdmin } from "@/lib/auth";
import { getDepartments } from "@/features/departments/queries/get-departments";
import {
  getAllStudents,
  getAllStudentsBatches,
  type AllStudentsPlacementFilter,
} from "@/features/students/queries/get-all-students";
import { SuperAdminStudentsClient } from "./super-admin-students-client";

interface SearchParams {
  deptId?: string;
  status?: string;
  batch?: string;
  backlogs?: string;
  search?: string;
  page?: string;
}

const STATUS_VALUES: AllStudentsPlacementFilter[] = ["placed", "not-placed", "not-yet-eligible"];

export default async function SuperAdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();

  const params = await searchParams;
  const page = Number(params.page) || 1;
  const deptId = params.deptId || undefined;
  const status: AllStudentsPlacementFilter = STATUS_VALUES.includes(
    params.status as AllStudentsPlacementFilter
  )
    ? (params.status as AllStudentsPlacementFilter)
    : "all";
  const batchYear = params.batch ? Number.parseInt(params.batch, 10) : null;
  const search = params.search || "";
  const hasBacklogs = params.backlogs === "1";

  const [result, departments, availableBatches] = await Promise.all([
    getAllStudents({
      page,
      pageSize: 50,
      search,
      deptId,
      batchYear: Number.isFinite(batchYear) ? batchYear : null,
      status,
      hasBacklogs,
    }),
    getDepartments({ page: 1, pageSize: 100, includeInactive: false }),
    getAllStudentsBatches(),
  ]);

  const totalPages = Math.ceil(result.totalCount / result.pageSize);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 className="page-title">Institution Student Directory</h1>
      </div>

      <SuperAdminStudentsClient
        students={result.data}
        currentPage={result.page}
        totalPages={totalPages}
        totalCount={result.totalCount}
        departments={departments.data}
        availableBatches={availableBatches}
        filters={{
          deptId: deptId || '',
          status,
          batch: batchYear !== null && Number.isFinite(batchYear) ? String(batchYear) : '',
          hasBacklogs,
          search,
        }}
      />
    </div>
  );
}
