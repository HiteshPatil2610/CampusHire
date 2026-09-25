"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import type { NotificationEvent } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
import { saveDepartmentSettings } from "../actions/save-settings";
import type { DepartmentSettingsView } from "../queries/get-settings";

interface DepartmentSettingsClientProps {
  admin: { name: string | null; email: string };
  department: { name: string; code: string; studentCount: number; isActive: boolean };
  settings: DepartmentSettingsView;
  mutedEvents: NotificationEvent[];
  /** Institution-wide values this admin can see but not change. */
  institution: {
    name: string;
    seasonStart: Date | null;
    seasonEnd: Date | null;
    enforceSeasonWindow: boolean;
  };
}

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "department", label: "Department" },
  { id: "drive-defaults", label: "Drive defaults" },
  { id: "students", label: "Student management" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
] as const;

const date = (value: Date | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not set";

/**
 * A department admin's settings.
 *
 * What they own — their department's drive defaults, its student defaults and
 * their own notifications — is editable. What the placement office owns is
 * shown as read-only with a line saying who sets it, rather than hidden: an
 * admin who cannot see the season window cannot understand why a next stage date
 * was refused. Identity and password live with the sign-in provider.
 */
export function DepartmentSettingsClient({
  admin,
  department,
  settings,
  mutedEvents,
  institution,
}: DepartmentSettingsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { openUserProfile } = useClerk();
  const [isPending, startTransition] = useTransition();
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("profile");

  const [form, setForm] = useState({
    defaultVenue: settings.defaultVenue ?? "",
    defaultReportingTime: settings.defaultReportingTime ?? "",
    coordinatorName: settings.coordinatorName ?? "",
    coordinatorPhone: settings.coordinatorPhone ?? "",
    coordinatorEmail: settings.coordinatorEmail ?? "",
    defaultInstructions: settings.defaultInstructions ?? "",
    defaultPassoutYear: settings.defaultPassoutYear ? String(settings.defaultPassoutYear) : "",
  });

  function save() {
    startTransition(async () => {
      const result = await saveDepartmentSettings({
        defaultVenue: form.defaultVenue || null,
        defaultReportingTime: form.defaultReportingTime || null,
        coordinatorName: form.coordinatorName || null,
        coordinatorPhone: form.coordinatorPhone || null,
        coordinatorEmail: form.coordinatorEmail || null,
        defaultInstructions: form.defaultInstructions || null,
        defaultPassoutYear: form.defaultPassoutYear ? Number(form.defaultPassoutYear) : null,
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
        style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}
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

      <div style={{ flex: 1, minWidth: 320, maxWidth: 680 }}>
        {section === "profile" && (
          <div className="card">
            <h2 className="section-title">Profile</h2>
            <ReadOnly label="Name" value={admin.name ?? "Not set"} />
            <ReadOnly label="Email" value={admin.email} />
            <ReadOnly label="Role" value={`Department admin — ${department.code}`} />
            <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
              Your name, email and password are held by the sign-in provider.
              Change them there and CampusHire follows.
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openUserProfile()}>
              Manage account →
            </button>
          </div>
        )}

        {section === "department" && (
          <div className="card">
            <h2 className="section-title">Department</h2>
            <p className="text-secondary" style={{ fontSize: 12, marginBottom: 12 }}>
              Set by the placement office. Ask them to change any of it.
            </p>
            <ReadOnly label="Department" value={`${department.name} (${department.code})`} />
            <ReadOnly label="Students" value={String(department.studentCount)} />
            <ReadOnly label="Status" value={department.isActive ? "Active" : "Inactive"} />
            <ReadOnly label="Institution" value={institution.name} />
            <ReadOnly
              label="Placement season"
              value={
                institution.seasonStart || institution.seasonEnd
                  ? `${date(institution.seasonStart)} — ${date(institution.seasonEnd)}${
                      institution.enforceSeasonWindow ? " (enforced on new drives)" : ""
                    }`
                  : "Not set"
              }
            />
          </div>
        )}

        {section === "drive-defaults" && (
          <div className="card">
            <h2 className="section-title">Drive defaults</h2>
            <p className="text-secondary" style={{ fontSize: 12, marginBottom: 14 }}>
              Prefilled when you configure a drive that is not published yet.
              They are only a starting point: you can change any of them on the
              drive itself, they never alter a drive you have already
              published, and they never override a field the placement office
              has locked.
            </p>

            <Field
              id="venue"
              label="Default venue"
              value={form.defaultVenue}
              onChange={(value) => setForm({ ...form, defaultVenue: value })}
              placeholder="e.g. Seminar Hall, Block B"
            />
            <Field
              id="reporting"
              label="Default reporting time"
              value={form.defaultReportingTime}
              onChange={(value) => setForm({ ...form, defaultReportingTime: value })}
              placeholder="e.g. 8:30 AM"
            />
            <Field
              id="coord-name"
              label="Coordinator"
              value={form.coordinatorName}
              onChange={(value) => setForm({ ...form, coordinatorName: value })}
              placeholder="Who students ask on the day"
            />
            <Field
              id="coord-phone"
              label="Coordinator phone"
              value={form.coordinatorPhone}
              onChange={(value) => setForm({ ...form, coordinatorPhone: value })}
            />
            <Field
              id="coord-email"
              label="Coordinator email"
              type="email"
              value={form.coordinatorEmail}
              onChange={(value) => setForm({ ...form, coordinatorEmail: value })}
            />

            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="instructions">Default instructions to students</label>
              <textarea
                id="instructions"
                rows={4}
                maxLength={2000}
                value={form.defaultInstructions}
                onChange={(e) => setForm({ ...form, defaultInstructions: e.target.value })}
                placeholder="e.g. Carry your ID card and two printed copies of your resume."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-strong)",
                  fontSize: 13,
                }}
              />
            </div>

            <SaveRow isPending={isPending} onSave={save} updated={settings} />
          </div>
        )}

        {section === "students" && (
          <div className="card">
            <h2 className="section-title">Student management</h2>
            <p className="text-secondary" style={{ fontSize: 12, marginBottom: 14 }}>
              Defaults for adding students to {department.code}. They prefill a
              form; nothing is applied to students who already exist.
            </p>
            <Field
              id="batch"
              label="Default batch (expected passout year)"
              type="number"
              value={form.defaultPassoutYear}
              onChange={(value) => setForm({ ...form, defaultPassoutYear: value })}
              placeholder="e.g. 2027"
            />
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
              Approving a student, locking their placement participation and
              importing a roster stay where they are, on{" "}
              <Link href="/admin-dashboard/students">Students</Link> — they act
              on real records, so they are not settings.
            </p>
            <SaveRow isPending={isPending} onSave={save} updated={settings} />
          </div>
        )}

        {section === "notifications" && (
          <NotificationPreferences role="DEPT_ADMIN" mutedEvents={mutedEvents} />
        )}

        {section === "security" && (
          <div className="card">
            <h2 className="section-title">Security</h2>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>
              Password, two-factor authentication and active sessions are held
              by the sign-in provider. CampusHire stores no password and has no
              password settings of its own.
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openUserProfile()}>
              Open security settings →
            </button>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
              Your access to {department.code} is granted by the placement
              office and can be disabled by them. If it is, your account and
              everything you have done stay exactly as they are.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
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

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="field" style={{ marginBottom: 12 }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SaveRow({
  isPending,
  onSave,
  updated,
}: {
  isPending: boolean;
  onSave: () => void;
  updated: { updatedAt: Date | null; updatedByName: string | null };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </button>
      {updated.updatedAt && (
        <span className="text-muted" style={{ fontSize: 11 }}>
          Last changed{" "}
          {new Date(updated.updatedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          })}
          {updated.updatedByName && ` by ${updated.updatedByName}`}
        </span>
      )}
    </div>
  );
}
