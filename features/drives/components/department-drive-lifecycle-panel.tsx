"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import type { DepartmentDriveStatus } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { publishDepartmentDrive } from "../actions/publish-department-drive";
import { setDepartmentDriveStatus } from "../actions/set-department-drive-status";

/**
 * The department admin's lifecycle control for their own instance of a drive.
 *
 *   ASSIGNED → CONFIGURED → PUBLISHED → CLOSED → ARCHIVED
 *
 * Publishing is what makes the drive visible to this department's students, and
 * it locks the application form at the same moment. The buttons here mirror the
 * server's transition rules for clarity, but the rules are enforced in the
 * actions — a hidden button is not a lock.
 */

interface DepartmentDriveLifecyclePanelProps {
  driveId: string;
  status: DepartmentDriveStatus;
  publishedAt: Date | string | null;
}

const STATUS_BADGE: Record<DepartmentDriveStatus, string> = {
  ASSIGNED: "badge-gray",
  CONFIGURED: "badge-purple",
  PUBLISHED: "badge-green",
  CLOSED: "badge-red",
  ARCHIVED: "badge-gray",
};

const STATUS_HELP: Record<DepartmentDriveStatus, string> = {
  ASSIGNED:
    "Assigned to your department by the Super Admin. Configure it, then publish to make it visible to your students.",
  CONFIGURED:
    "Configured but not yet visible. Publish to release it to your eligible students.",
  PUBLISHED:
    "Live for your eligible students. The application form is locked; venue and coordinator details can still be updated.",
  CLOSED:
    "Administratively closed — no new applications. This is separate from the application deadline.",
  ARCHIVED: "Archived. This drive is historical for your department.",
};

export function DepartmentDriveLifecyclePanel({
  driveId,
  status,
  publishedAt,
}: DepartmentDriveLifecyclePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    startTransition(async () => {
      const result = await publishDepartmentDrive({ driveId });

      if (!result.success) {
        toast({
          title: "Could not publish",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Drive published",
        description:
          result.notified > 0
            ? `${result.notified} eligible student${result.notified === 1 ? "" : "s"} notified.`
            : "No eligible students to notify yet.",
      });
      router.refresh();
    });
  }

  function handleStatus(next: "CLOSED" | "ARCHIVED") {
    startTransition(async () => {
      const result = await setDepartmentDriveStatus({ driveId, status: next });

      if (!result.success) {
        toast({
          title: "Could not update",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: `Drive ${next.toLowerCase()}` });
      router.refresh();
    });
  }

  const canPublish = status === "ASSIGNED" || status === "CONFIGURED";
  const publishedLabel =
    publishedAt !== null
      ? new Date(publishedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <section
      style={{
        marginTop: 16,
        padding: 14,
        border: "0.5px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface-1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`badge ${STATUS_BADGE[status]}`} style={{ fontSize: 10 }}>
            {status}
          </span>
          {status === "PUBLISHED" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <Lock size={11} aria-hidden />
              Form locked{publishedLabel ? ` · published ${publishedLabel}` : ""}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {canPublish && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isPending}
              onClick={handlePublish}
            >
              {isPending ? "Publishing…" : "Publish to students"}
            </button>
          )}

          {status === "PUBLISHED" && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => handleStatus("CLOSED")}
            >
              Close applications
            </button>
          )}

          {(status === "CLOSED" || status === "PUBLISHED") && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => handleStatus("ARCHIVED")}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      <p
        style={{
          margin: "10px 0 0",
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {STATUS_HELP[status]}
      </p>
    </section>
  );
}
