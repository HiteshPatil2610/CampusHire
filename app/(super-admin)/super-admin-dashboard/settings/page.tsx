import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstitutionSettings } from "@/features/settings/queries/get-settings";
import { getMyMutedEvents } from "@/features/notifications/actions/set-notification-preference";
import { InstitutionSettingsClient } from "@/features/settings/components/institution-settings-client";
import { toStageDrafts } from "@/features/recruitment/components/pipeline-editor";
import { institutionDefaultStages } from "@/features/settings/domain/default-pipeline";

export const dynamic = "force-dynamic";

/**
 * The institution's configuration. Every setting here is one the application
 * reads; the screen says which and when.
 */
export default async function InstitutionSettingsPage() {
  const superAdmin = await requireSuperAdmin();

  const [settings, mutedEvents, departments, activeAdmins, invitedAdmins, students, drives] =
    await Promise.all([
      getInstitutionSettings(),
      getMyMutedEvents(),
      prisma.department.count(),
      prisma.departmentAdmin.count({ where: { status: "ACTIVE" } }),
      prisma.adminInvitation.count({ where: { status: "INVITED" } }),
      prisma.student.count({ where: { isPending: false } }),
      prisma.drive.count(),
    ]);

  const stages = institutionDefaultStages(settings.defaultPipelineStages);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Settings
        </h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Institution-wide configuration. Changes apply to what happens next —
          drives, applications and placements that already exist are never
          re-judged.
        </p>
      </div>

      <InstitutionSettingsClient
        superAdmin={{ name: superAdmin.name, email: superAdmin.email }}
        settings={settings}
        mutedEvents={mutedEvents}
        stats={{ departments, activeAdmins, invitedAdmins, students, drives }}
        defaultStages={toStageDrafts(stages)}
      />
    </div>
  );
}
