"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { approveSkill, rejectSkill } from "@/features/skills/actions/review-skill";
import type { PendingSkillRow } from "@/features/skills/queries/get-pending-skills";

const TYPE_LABEL: Record<PendingSkillRow["skillType"], string> = {
  TECHNICAL: "Technical",
  SOFT: "Soft",
};

function when(date: Date | string): string {
  return new Date(date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function SkillsReviewClient({ pending }: { pending: PendingSkillRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function approve(skillId: string) {
    setBusyId(skillId);
    startTransition(async () => {
      const result = await approveSkill({ skillId });
      setBusyId(null);
      if (result.success) {
        toast({ title: "Approved", description: result.message });
        router.refresh();
      } else {
        toast({ title: "Could not approve", description: result.error, variant: "destructive" });
      }
    });
  }

  function reject(skillId: string) {
    setBusyId(skillId);
    startTransition(async () => {
      const result = await rejectSkill({ skillId, reason: reason.trim() || undefined });
      setBusyId(null);
      setRejecting(null);
      setReason("");
      if (result.success) {
        toast({ title: "Rejected", description: result.message });
        router.refresh();
      } else {
        toast({ title: "Could not reject", description: result.error, variant: "destructive" });
      }
    });
  }

  if (pending.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 14 }}>Nothing waiting for review.</div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
          Every skill a student has typed is already on the master list.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {pending.map((skill) => (
        <div key={skill.id} className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 15 }}>{skill.name}</strong>
                <span className="badge badge-gray" style={{ fontSize: 10 }}>
                  {TYPE_LABEL[skill.skillType]}
                </span>
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                Requested {when(skill.requestedAt)}
                {skill.requestedBy && (
                  <>
                    {" · by "}
                    {skill.requestedBy.name ?? "a student"}
                    {skill.requestedBy.rollNumber ? ` (${skill.requestedBy.rollNumber})` : ""}
                    {` · ${skill.requestedBy.departmentCode}`}
                  </>
                )}
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                On {skill.studentCount} student profile{skill.studentCount === 1 ? "" : "s"} right now
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isPending && busyId === skill.id}
                onClick={() => approve(skill.id)}
              >
                {isPending && busyId === skill.id ? "…" : "Approve"}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ color: "var(--red)" }}
                disabled={isPending}
                onClick={() => setRejecting(rejecting === skill.id ? null : skill.id)}
              >
                Reject
              </button>
            </div>
          </div>

          {rejecting === skill.id && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
              <input
                style={{ flex: 1, minWidth: 220, padding: "7px 10px", fontSize: 12, borderRadius: 6, border: "0.5px solid var(--border-strong)" }}
                placeholder="Reason (optional, kept in the audit log)"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ background: "var(--red)", borderColor: "var(--red)" }}
                disabled={isPending && busyId === skill.id}
                onClick={() => reject(skill.id)}
              >
                Confirm reject
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setRejecting(null);
                  setReason("");
                }}
              >
                Cancel
              </button>
              {skill.studentCount > 0 && (
                <div style={{ width: "100%", fontSize: 11, color: "var(--red)" }}>
                  This removes &quot;{skill.name}&quot; from {skill.studentCount} student profile
                  {skill.studentCount === 1 ? "" : "s"} that already added it.
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
