"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { archiveAnnouncement, publishAnnouncement } from "../actions/manage-announcement";
import { AnnouncementComposer, type ComposerDepartment } from "./announcement-composer";
import type { AnnouncementRow } from "../queries/get-announcements";
import { batchLabel } from "@/features/students/utils/batch";

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

/** Sentinel for "institution-wide" in the department filter — distinct from "all". */
const INSTITUTION_WIDE = "__institution_wide__";

/**
 * Writing and managing announcements: the composer, then everything this
 * author is responsible for — drafts, scheduled, published and archived.
 *
 * A department admin sees their own department's, already scoped by the
 * query; a Super Admin sees every department's, which is why only they get a
 * department filter — narrowing one department down to itself would do
 * nothing for anyone else.
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
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const visible = useMemo(() => {
    const filtered =
      departmentFilter === "all"
        ? managed
        : managed.filter((announcement) =>
            departmentFilter === INSTITUTION_WIDE
              ? announcement.departmentCode === null
              : announcement.departmentCode === departmentFilter
          );

    const dated = (announcement: AnnouncementRow) =>
      new Date(announcement.publishAt ?? announcement.createdAt).getTime();

    return [...filtered].sort((a, b) =>
      sortOrder === "newest" ? dated(b) - dated(a) : dated(a) - dated(b)
    );
  }, [managed, departmentFilter, sortOrder]);

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <h3 className="section-title" style={{ margin: 0 }}>
            {isSuperAdmin ? "All announcements" : `${departmentName ?? "Department"} announcements`}
          </h3>

          {managed.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {isSuperAdmin && (
                <select
                  aria-label="Filter by department"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  style={{ fontSize: 12, padding: "4px 6px" }}
                >
                  <option value="all">Every department</option>
                  <option value={INSTITUTION_WIDE}>Institution-wide</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.code}>
                      {department.code}
                    </option>
                  ))}
                </select>
              )}
              <select
                aria-label="Sort by date"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
                style={{ fontSize: 12, padding: "4px 6px" }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          )}
        </div>

        {managed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-secondary)" }}>
            Nothing here yet.
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-secondary)" }}>
            No announcements match this filter.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {visible.map((announcement) => (
              <div
                key={announcement.id}
                style={{
                  padding: "12px 14px",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
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
                          ` · batch ${announcement.batchYears.map(batchLabel).join(", ")}`}
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
                      {announcement.editedAt && " · edited"}
                    </div>
                  </div>

                  {announcement.canManage && announcement.status !== "ARCHIVED" && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {deleting === announcement.id ? (
                        <>
                          <span className="text-muted" style={{ fontSize: 11 }}>
                            Delete “{announcement.title}”?
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ color: "var(--red)" }}
                            disabled={isPending}
                            onClick={() => {
                              setDeleting(null);
                              startTransition(async () => {
                                const result = await archiveAnnouncement({ id: announcement.id });
                                if (!result.success) {
                                  toast({
                                    title: "Could not delete",
                                    description: result.error,
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                toast({ title: "Deleted" });
                                router.refresh();
                              });
                            }}
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={isPending}
                            onClick={() => setDeleting(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
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
                            style={{ color: "var(--red)" }}
                            disabled={isPending}
                            onClick={() => setDeleting(announcement.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
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
