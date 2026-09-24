"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  publishAnnouncement,
  saveAnnouncement,
  uploadAnnouncementFile,
} from "../actions/manage-announcement";
import { batchLabel } from "@/features/students/utils/batch";
import type { AnnouncementRow } from "../queries/get-announcements";

export interface ComposerDepartment {
  id: string;
  code: string;
  name: string;
}

interface AnnouncementComposerProps {
  /** Super Admins choose scope, audience and priority; department admins do not. */
  isSuperAdmin: boolean;
  departments: ComposerDepartment[];
  batchYears: number[];
  departmentName?: string;
  /** Editing an existing announcement, instead of writing a new one. */
  editing?: AnnouncementRow | null;
  onDone?: () => void;
}

const PRIORITIES = ["INFO", "SUCCESS", "WARNING", "ACTION_REQUIRED", "URGENT"] as const;

/**
 * Writing an announcement.
 *
 * Saving keeps it a draft, which notifies nobody; publishing is a separate,
 * deliberate step, and a publication time in the future schedules it. The
 * scope controls a department admin does not have are simply not rendered —
 * and the server decides scope from the session regardless of what is sent.
 */
export function AnnouncementComposer({
  isSuperAdmin,
  departments,
  batchYears,
  departmentName,
  editing = null,
  onDone,
}: AnnouncementComposerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState({
    title: editing?.title ?? "",
    content: editing?.content ?? "",
    audience: (editing?.audience ?? "STUDENTS") as "STUDENTS" | "ADMINS" | "EVERYONE",
    departmentId: editing?.departmentCode
      ? departments.find((d) => d.code === editing.departmentCode)?.id ?? ""
      : "",
    batchYears: editing?.batchYears ?? ([] as number[]),
    priority: (editing?.priority ?? "INFO") as (typeof PRIORITIES)[number],
    publishAt: "",
    expiresAt: editing?.expiresAt ? toLocalInput(new Date(editing.expiresAt)) : "",
    attachmentUrl: editing?.attachmentUrl ?? null,
    attachmentName: editing?.attachmentName ?? null,
  });

  const live = editing?.status === "PUBLISHED";

  function payload() {
    return {
      id: editing?.id,
      title: form.title.trim(),
      content: form.content.trim(),
      audience: form.audience,
      departmentId: isSuperAdmin ? form.departmentId || null : undefined,
      batchYears: form.batchYears,
      priority: form.priority,
      publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      attachmentUrl: form.attachmentUrl,
      attachmentName: form.attachmentName,
    };
  }

  function handleSave(thenPublish: boolean) {
    if (form.title.trim().length < 3 || form.content.trim().length < 3) {
      toast({
        title: "Not ready",
        description: "Give it a title and some content.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const saved = await saveAnnouncement(payload());
      if (!saved.success) {
        toast({ title: "Could not save", description: saved.error, variant: "destructive" });
        return;
      }

      if (!thenPublish) {
        toast({ title: "Saved", description: "Kept as a draft. Nobody has been notified." });
        router.refresh();
        onDone?.();
        return;
      }

      const published = await publishAnnouncement({
        id: saved.id,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      });
      if (!published.success) {
        toast({ title: "Could not publish", description: published.error, variant: "destructive" });
        return;
      }
      toast({ title: "Published", description: published.message });
      router.refresh();
      onDone?.();
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.set("file", file);
    const result = await uploadAnnouncementFile(data);
    setUploading(false);
    if (!result.success) {
      toast({ title: "Upload failed", description: result.error, variant: "destructive" });
      return;
    }
    setForm((current) => ({ ...current, attachmentUrl: result.url, attachmentName: result.name }));
  }

  /**
   * Wraps the selected text (or inserts a placeholder) with rich-text
   * syntax at the textarea's cursor — see `render-rich-text.tsx` for how
   * `**bold**`, `- item` and `[text](url)` are rendered back out safely.
   */
  function applyFormatting(before: string, after: string, placeholder: string) {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = form.content.slice(start, end) || placeholder;
    const next = form.content.slice(0, start) + before + selected + after + form.content.slice(end);
    setForm({ ...form, content: next });
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function applyBulletList() {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = form.content.slice(start, end) || "List item";
    const bulleted = selected
      .split("\n")
      .map((line) => (line.trim() ? `- ${line}` : line))
      .join("\n");
    const next = form.content.slice(0, start) + bulleted + form.content.slice(end);
    setForm({ ...form, content: next });
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + bulleted.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 className="section-title">{editing ? "Edit announcement" : "New announcement"}</h3>
      <p className="text-secondary" style={{ fontSize: 12, marginBottom: 14 }}>
        {isSuperAdmin
          ? "Reaches the whole institution, or one department."
          : `Reaches the students of ${departmentName ?? "your department"}.`}
        {" A draft notifies nobody until you publish it."}
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="ann-title">Title *</label>
        <input
          id="ann-title"
          maxLength={200}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Pre-placement talk on Friday"
        />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="ann-content">Announcement *</label>
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px" }}
            title="Bold"
            onClick={() => applyFormatting("**", "**", "bold text")}
          >
            B
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11, padding: "2px 8px" }}
            title="Bullet list"
            onClick={applyBulletList}
          >
            • List
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ fontSize: 11, padding: "2px 8px" }}
            title="Link"
            onClick={() => applyFormatting("[", "](https://)", "link text")}
          >
            🔗 Link
          </button>
        </div>
        <textarea
          id="ann-content"
          ref={contentRef}
          rows={6}
          maxLength={10000}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="What do they need to know?"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 6,
            border: "0.5px solid var(--border-strong)",
            fontSize: 13,
          }}
        />
        <span className="text-muted" style={{ fontSize: 11 }}>
          {form.content.length}/10000 · **bold**, "- " for a list, [text](url) for a link
        </span>
      </div>

      {!live && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          {isSuperAdmin && (
            <>
              <div className="field" style={{ minWidth: 200 }}>
                <label htmlFor="ann-dept">Department</label>
                <select
                  id="ann-dept"
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                >
                  <option value="">Institution-wide</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code} — {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ minWidth: 160 }}>
                <label htmlFor="ann-audience">Audience</label>
                <select
                  id="ann-audience"
                  value={form.audience}
                  onChange={(e) =>
                    setForm({ ...form, audience: e.target.value as typeof form.audience })
                  }
                >
                  <option value="STUDENTS">Students</option>
                  <option value="ADMINS">Department admins</option>
                  <option value="EVERYONE">Everyone</option>
                </select>
              </div>

              <div className="field" style={{ minWidth: 160 }}>
                <label htmlFor="ann-priority">Priority</label>
                <select
                  id="ann-priority"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value as typeof form.priority })
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority.replace("_", " ").toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {!isSuperAdmin && (
            <div className="field" style={{ minWidth: 160 }}>
              <label htmlFor="ann-priority">Priority</label>
              <select
                id="ann-priority"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value as typeof form.priority })
                }
              >
                {PRIORITIES.filter((priority) => priority !== "URGENT").map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.replace("_", " ").toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.audience !== "ADMINS" && batchYears.length > 0 && (
            <div className="field" style={{ minWidth: 220 }}>
              <label>Batches (all, if none chosen)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {batchYears.map((year) => {
                  const on = form.batchYears.includes(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      className={`filter-pill ${on ? "active" : ""}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          batchYears: on
                            ? form.batchYears.filter((value) => value !== year)
                            : [...form.batchYears, year],
                        })
                      }
                    >
                      {batchLabel(year)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {!live && (
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="ann-publish">Publish at (now, if empty)</label>
            <input
              id="ann-publish"
              type="datetime-local"
              value={form.publishAt}
              onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
            />
          </div>
        )}

        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="ann-expires">Hide after (optional)</label>
          <input
            id="ann-expires"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
        </div>

        <div className="field" style={{ minWidth: 220 }}>
          <label htmlFor="ann-file">Attachment (PDF or image, 5MB)</label>
          <input
            id="ann-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            disabled={uploading || isPending}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          {form.attachmentName && (
            <span className="text-muted" style={{ fontSize: 11 }}>
              {form.attachmentName}{" "}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setForm({ ...form, attachmentUrl: null, attachmentName: null })}
              >
                Remove
              </button>
            </span>
          )}
          {uploading && (
            <span className="text-muted" style={{ fontSize: 11 }}>
              Uploading…
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-outline"
          disabled={isPending || uploading}
          onClick={() => handleSave(false)}
        >
          {isPending ? "Saving…" : "Save draft"}
        </button>
        {!live && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={isPending || uploading}
            onClick={() => handleSave(true)}
          >
            {form.publishAt ? "Schedule" : "Publish now"}
          </button>
        )}
      </div>
    </div>
  );
}

/** A Date as the value a `datetime-local` input expects. */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
