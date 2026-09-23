import { requireDepartmentAdmin } from "@/lib/auth";
import { ExcelImportClient } from "./excel-import-client";
import AccessRequestsPanel from "@/components/admin/students/access-requests-panel";
import { getAccessRequests } from "@/features/students/queries/get-access-requests";

// Every query here is scoped to the signed-in admin's department, so this
// page can never be prerendered - it has no meaning without a session.
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { department } = await requireDepartmentAdmin();
  const pendingRequests = await getAccessRequests("PENDING");

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="page-title">Bulk Student Import</h1>
          <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
            Import students into the {department.name} placement database via
            Excel or CSV.
          </p>
        </div>
      </div>

      <ExcelImportClient departmentCode={department.code} />

      {/*
        Sign-ups that could not be matched against the imported roster. A
        sign-up whose email DOES match is linked automatically and never
        appears here, so everything in this list is someone nobody has
        vouched for yet.
      */}
      <section style={{ marginTop: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <h2 className="section-title" style={{ margin: 0, fontSize: 16 }}>
            Student access requests
          </h2>
          {pendingRequests.length > 0 && (
            <span className="badge badge-amber" style={{ fontSize: 10 }}>
              {pendingRequests.length} pending
            </span>
          )}
        </div>
        <p
          className="text-secondary"
          style={{ fontSize: 12, marginBottom: 12, maxWidth: 680 }}
        >
          People who signed up themselves but were not in your imported roster.
          Approving creates their student record; declining tells them why.
        </p>

        <AccessRequestsPanel
          requests={pendingRequests.map((request) => ({
            id: request.id,
            name: request.name,
            email: request.email,
            misNumber: request.misNumber,
            prnNumber: request.prnNumber,
            rollNumber: request.rollNumber,
            expectedPassoutYear: request.expectedPassoutYear,
            phoneNumber: request.phoneNumber,
            entryType: request.entryType,
            rosterMatch: request.rosterMatch,
            createdAt: request.createdAt,
          }))}
          departmentCode={department.code}
        />
      </section>
    </div>
  );
}
