"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { archiveAnnouncement, publishAnnouncement } from "../actions/manage-announcement";
import { AnnouncementComposer, type ComposerDepartment } from "./announcement-composer";
import type { AnnouncementRow } from "../queries/get-announcements";

interface AnnouncementManagerProps {
  isSuperAdmin: boolean;
  departments: ComposerDepartment[];
  batchYears: number[];
  departmentName?: string;
  managed: AnnouncementRow[];
  basePath: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge-gray",
  SCHEDULED: "badge-amber",
  PUBLISHED: "badge-green",
  ARCHIVED: "badge-gray",
};

/**
 * Writing and managing announcements: the composer, then everything this
 * author is responsible for — drafts, scheduled, published and archived.
 *
 * A department admin sees their own department's; a Super Admin sees every
 * one, which is how the placement office moderates what departments publish.
 */
export function AnnouncementManager({
  isSuperAdmin,
  departments,
  batchYears,
  departmentName,
  managed,
  basePath,
}: AnnouncementManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);

  function act(
    run: () => Promise<{ success: boolean; message?: string; error?: string }>,
    fallback: string
  ) {
    startTransition(async () => {
      const result = await run();
      if (!result.success) {
        toast({ title: "Could not do that", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: fallback, description: result.message });
      router.refresh();
    });
  }

  return (
    <div>
      <AnnouncementComposer
        key={editing?.id ?? "new"}
        isSuperAdmin={isSuperAdmin}
        departments={departments}
        batchYears={batchYears}
        departmentName={departmentName}
        editing={editing}
        onDone={() => setEditing(null)}
      />

      {editing && (
        <p style={{ marginTop: -8, marginBottom: 16 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
            Cancel editing “{editing.title}”
          </button>
        </p>
      )}

      <div className="card">
        <h3 className="section-title">
          {isSuperAdmin ? "All announcements" : `${departmentName ?? "Department"} announcements`}
        </h3>

        {managed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-secondary)" }}>
            Nothing here yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {managed.map((announcement) => (
              <div
                key={announcement.id}
                style={{
                  padding: "12px 14px",
                  background: "var(--surface-1)",
                  border: "0.5px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`badge ${STATUS_BADGE[announcement.status] ?? "badge-gray"}`}>
                        {announcement.status.toLowerCase()}
                      </span>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        {announcement.departmentCode ?? "Institution-wide"} ·{" "}
                        {announcement.audience.toLowerCase()}
                        {announcement.batchYears.length > 0 &&
                          ` · batch ${announcement.batchYears.join(", ")}`}
                      </span>
                    </div>
                    <Link
                      href={`${basePath}/${announcement.id}`}
                      style={{ fontWeight: 600, fontSize: 13, display: "block", marginTop: 4 }}
                    >
                      {announcement.title}
                    </Link>
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                      {announcement.authorName}
                      {announcement.publishAt &&
                        ` · ${new Date(announcement.publishAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Kolkata",
                        })}`}
                    </div>
                  </div>

                  {announcement.canManage && announcement.status !== "ARCHIVED" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={isPending}
                        onClick={() => setEditing(announcement)}
                      >
                        Edit
                      </button>
                      {announcement.status !== "PUBLISHED" && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={isPending}
                          onClick={() =>
                            act(
                              () => publishAnnouncement({ id: announcement.id, publishAt: null }),
                              "Published"
                            )
                          }
                        >
                          Publish now
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={isPending}
                        onClick={() =>
                          act(() => archiveAnnouncement({ id: announcement.id }), "Archived")
                        }
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
