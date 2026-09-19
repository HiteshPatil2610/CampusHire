import { requireSuperAdmin } from "@/lib/auth";
import { getPipelineRequests } from "@/features/recruitment/queries/get-pipeline-requests";
import { PipelineRequestsClient } from "./pipeline-requests-client";

export const dynamic = "force-dynamic";

/**
 * Recruitment pipeline change requests from department admins. Nothing a
 * department proposes for a published drive takes effect until it is
 * approved here.
 */
export default async function PipelineRequestsPage() {
  await requireSuperAdmin();
  const requests = await getPipelineRequests();

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Pipeline Requests</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Changes department admins have proposed to published drives&apos; recruitment
          pipelines. Approving one makes it the drive&apos;s new pipeline version; applicants
          already in progress keep their stage and join it when next moved.
        </p>
      </div>
      <PipelineRequestsClient requests={requests} />
    </div>
  );
}
