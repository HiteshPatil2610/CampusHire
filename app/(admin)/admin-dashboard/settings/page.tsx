import { requireDepartmentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepartmentSettings, getInstitutionSettings } from "@/features/settings/queries/get-settings";
import { getMyMutedEvents } from "@/features/notifications/actions/set-notification-preference";
import { DepartmentSettingsClient } from "@/features/settings/components/department-settings-client";

// Everything here is scoped to the signed-in admin's department.
export const dynamic = "force-dynamic";

export default async function DepartmentSettingsPage() {
  const { user, department } = await requireDepartmentAdmin();

  const [settings, institution, mutedEvents, studentCount] = await Promise.all([
    getDepartmentSettings(department.id),
    getInstitutionSettings(),
    getMyMutedEvents(),
    prisma.student.count({ where: { departmentId: department.id, isPending: false } }),
  ]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Settings
        </h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Your department&apos;s defaults and your own notifications. What the
          placement office sets is shown but not editable here.
        </p>
      </div>

      <DepartmentSettingsClient
        admin={{ name: user.name, email: user.email }}
        department={{
          name: department.name,
          code: department.code,
          studentCount,
          isActive: department.isActive,
        }}
        settings={settings}
        mutedEvents={mutedEvents}
        institution={{
          name: institution.institutionName,
          seasonStart: institution.seasonStart,
          seasonEnd: institution.seasonEnd,
          enforceSeasonWindow: institution.enforceSeasonWindow,
        }}
      />
    </div>
  );
}
