"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import type { NotificationEvent } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import {
  PipelineEditor,
  fromStageDrafts,
  type StageDraft,
} from "@/features/recruitment/components/pipeline-editor";
import { saveInstitutionSettings } from "../actions/save-settings";
import type { InstitutionSettingsView } from "../queries/get-settings";

interface InstitutionSettingsClientProps {
  superAdmin: { name: string | null; email: string };
  settings: InstitutionSettingsView;
  mutedEvents: NotificationEvent[];
  stats: {
    departments: number;
    activeAdmins: number;
    invitedAdmins: number;
    students: number;
    drives: number;
  };
  /** The default pipeline as the editor's drafts. */
  defaultStages: StageDraft[];
}

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "institution", label: "Institution" },
  { id: "drive-defaults", label: "Drive & eligibility defaults" },
  { id: "recruitment", label: "Recruitment defaults" },
  { id: "people", label: "Departments & admins" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "system", label: "System & audit" },
] as const;

const toInput = (value: Date | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

/**
 * The institution's settings.
 *
 * Every field here is one the application actually reads — the name it shows
 * people, the season it enforces on new drives, the values it prefills. The
 * screen says what each one does and when it takes effect, so nothing looks
 * more powerful than it is.
 */
export function InstitutionSettingsClient({
  superAdmin,
  settings,
  mutedEvents,
  stats,
  defaultStages,
}: InstitutionSettingsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { openUserProfile } = useClerk();
  const [isPending, startTransition] = useTransition();
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("institution");

  const [form, setForm] = useState({
    institutionName: settings.institutionName,
    seasonStart: toInput(settings.seasonStart),
    seasonEnd: toInput(settings.seasonEnd),
    enforceSeasonWindow: settings.enforceSeasonWindow,
    defaultMinCGPA: settings.defaultMinCGPA !== null ? String(settings.defaultMinCGPA) : "",
    defaultMaxBacklogs:
      settings.defaultMaxBacklogs !== null ? String(settings.defaultMaxBacklogs) : "",
  });
  const [stages, setStages] = useState<StageDraft[]>(defaultStages);

  function save(includeStages = false) {
    startTransition(async () => {
      const result = await saveInstitutionSettings({
        institutionName: form.institutionName.trim(),
        seasonStart: form.seasonStart || null,
        seasonEnd: form.seasonEnd || null,
        enforceSeasonWindow: form.enforceSeasonWindow,
        defaultMinCGPA: form.defaultMinCGPA === "" ? null : Number(form.defaultMinCGPA),
        defaultMaxBacklogs:
          form.defaultMaxBacklogs === "" ? null : Number(form.defaultMaxBacklogs),
        defaultPipelineStages: includeStages
          ? fromStageDrafts(stages)
          : settings.defaultPipelineStages
            ? (JSON.parse(settings.defaultPipelineStages) as unknown)
            : undefined,
      });
      if (!result.success) {
        toast({ title: "Not saved", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Saved", description: result.message });
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
      <nav
        aria-label="Settings sections"
        style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 210 }}
      >
        {SECTIONS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`filter-pill ${section === entry.id ? "active" : ""}`}
            style={{ justifyContent: "flex-start" }}
            aria-current={section === entry.id ? "page" : undefined}
            onClick={() => setSection(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, minWidth: 320, maxWidth: 720 }}>
        {section === "profile" && (
          <div className="card">
            <h2 className="section-title">Profile</h2>
            <Row label="Name" value={superAdmin.name ?? "Not set"} />
            <Row label="Email" value={superAdmin.email} />
            <Row label="Role" value="Super Admin — every department" />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ marginTop: 12 }}
              onClick={() => openUserProfile()}
            >
              Manage account →
            </button>
          </div>
        )}

        {section === "institution" && (
          <div className="card">
            <h2 className="section-title">Institution</h2>
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="institution-name">Institution name</label>
              <input
                id="institution-name"
                className="input"
                maxLength={200}
                value={form.institutionName}
                onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
              />
              <span className="text-muted" style={{ fontSize: 11 }}>
                Shown wherever CampusHire names the placement office to
                students and admins.
              </span>
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "16px 0 8px" }}>
              Placement season
            </h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 180 }}>
                <label htmlFor="season-start">Starts</label>
                <input
                  id="season-start"
                  type="date"
                  className="input"
                  value={form.seasonStart}
                  onChange={(e) => setForm({ ...form, seasonStart: e.target.value })}
                />
              </div>
              <div className="field" style={{ minWidth: 180 }}>
                <label htmlFor="season-end">Ends</label>
                <input
                  id="season-end"
                  type="date"
                  className="input"
                  value={form.seasonEnd}
                  onChange={(e) => setForm({ ...form, seasonEnd: e.target.value })}
                />
              </div>
            </div>

            <label
              style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={form.enforceSeasonWindow}
                onChange={(e) => setForm({ ...form, enforceSeasonWindow: e.target.checked })}
                style={{ marginTop: 3 }}
              />
              <span>
                Refuse new drives with a date outside the season.
                <span className="text-muted" style={{ display: "block", fontSize: 11 }}>
                  Applies when a drive is created, by you or by a department.
                  Drives that already exist, and applications to them, are never
                  affected.
                </span>
              </span>
            </label>

            <SaveRow isPending={isPending} onSave={() => save()} settings={settings} />
          </div>
        )}

        {section === "drive-defaults" && (
          <div className="card">
            <h2 className="section-title">Drive &amp; eligibility defaults</h2>
            <p className="text-secondary" style={{ fontSize: 12, marginBottom: 14 }}>
              Prefilled into a new drive. A drive&apos;s own rules always win,
              and changing these never re-judges an application that has
              already been submitted.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="field" style={{ minWidth: 180 }}>
                <label htmlFor="default-cgpa">Default minimum CGPA</label>
                <input
                  id="default-cgpa"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  className="input"
                  value={form.defaultMinCGPA}
                  onChange={(e) => setForm({ ...form, defaultMinCGPA: e.target.value })}
                  placeholder="e.g. 6.5"
                />
              </div>
              <div className="field" style={{ minWidth: 180 }}>
                <label htmlFor="default-backlogs">Default active backlogs allowed</label>
                <input
                  id="default-backlogs"
                  type="number"
                  min="0"
                  max="50"
                  className="input"
                  value={form.defaultMaxBacklogs}
                  onChange={(e) => setForm({ ...form, defaultMaxBacklogs: e.target.value })}
                  placeholder="e.g. 0"
                />
              </div>
            </div>
            <SaveRow isPending={isPending} onSave={() => save()} settings={settings} />
          </div>
        )}

        {section === "recruitment" && (
          <div className="card">
            <h2 className="section-title">Recruitment defaults</h2>
            <p className="text-secondary" style={{ fontSize: 12, marginBottom: 14 }}>
              The stages a new master drive starts with. A drive&apos;s
              pipeline is its own from the moment it is created — changing
              these never touches a drive that exists, and never a published
              one.
            </p>
            <PipelineEditor drafts={stages} onChange={setStages} />
            <SaveRow isPending={isPending} onSave={() => save(true)} settings={settings} />
          </div>
        )}

        {section === "people" && (
          <div className="card">
            <h2 className="section-title">Departments &amp; admins</h2>
            <Row label="Departments" value={String(stats.departments)} />
            <Row label="Active department admins" value={String(stats.activeAdmins)} />
            <Row label="Invitations waiting" value={String(stats.invitedAdmins)} />
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Link href="/super-admin-dashboard/departments" className="btn btn-outline btn-sm">
                Manage departments →
              </Link>
              <Link href="/super-admin-dashboard/admins" className="btn btn-outline btn-sm">
                Manage admins →
              </Link>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
              Departments and admins act on real records — creating,
              disabling, moving — so they live on their own screens rather than
              here.
            </p>
          </div>
        )}

        {section === "notifications" && (
          <NotificationPreferences role="SUPER_ADMIN" mutedEvents={mutedEvents} />
        )}

        {section === "security" && (
          <div className="card">
            <h2 className="section-title">Security</h2>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>
              Password, two-factor authentication and sessions are held by the
              sign-in provider. CampusHire stores no password, issues none, and
              has no password settings of its own — inviting an admin sends
              them there to set their own.
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openUserProfile()}>
              Open security settings →
            </button>
          </div>
        )}

        {section === "system" && (
          <div className="card">
            <h2 className="section-title">System &amp; audit</h2>
            <Row label="Students" value={String(stats.students)} />
            <Row label="Drives" value={String(stats.drives)} />
            <Row
              label="Settings last changed"
              value={
                settings.updatedAt.getTime() > 0
                  ? `${new Date(settings.updatedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    })}${settings.updatedByName ? ` by ${settings.updatedByName}` : ""}`
                  : "Never"
              }
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Link href="/audit-logs" className="btn btn-outline btn-sm">
                Audit log →
              </Link>
              <Link
                href="/super-admin-dashboard/notification-deliveries"
                className="btn btn-outline btn-sm"
              >
                Notification deliveries →
              </Link>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
              Audit entries are never edited or deleted, and there is no
              retention setting that would quietly remove them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: 13,
      }}
    >
      <span className="text-secondary">{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SaveRow({
  isPending,
  onSave,
  settings,
}: {
  isPending: boolean;
  onSave: () => void;
  settings: InstitutionSettingsView;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </button>
      {settings.updatedAt.getTime() > 0 && (
        <span className="text-muted" style={{ fontSize: 11 }}>
          Last changed{" "}
          {new Date(settings.updatedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          })}
          {settings.updatedByName && ` by ${settings.updatedByName}`}
        </span>
      )}
    </div>
  );
}
