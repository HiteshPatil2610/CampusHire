import { requireSuperAdmin } from "@/lib/auth";
import { SystemSettingsClient } from "./system-settings-client";

export default async function SystemSettingsPage() {
  await requireSuperAdmin();

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 20 }}>
        System Settings
      </h1>
      
      <div className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
        Configure institution-wide placement settings
      </div>

      <SystemSettingsClient />
    </div>
  );
}
