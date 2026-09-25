"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { updateApplicationStage } from "@/features/applications/actions/update-application-stage";
import { revokePlacement } from "../actions/manage-placement";
import type { DrivePlacementCandidate, DrivePlacements } from "../queries/get-drive-placements";
import { PlacementConfirmDialog } from "./placement-confirm-dialog";

/**
 * The Placement tab of a department drive.
 *
 *  - Ready to place: applicants waiting at the Offer stage. Placing one is
 *    selecting them, behind a confirmation that says what becomes permanent.
 *  - Placements from this drive: who was placed, when, by whom — revoked ones
 *    included, with the reason. A mistake is revoked, never edited or deleted.
 *
 * Student-facing: a placed student sees "You are placed" and cannot change it;
 * nothing on this tab is reachable by a student.
 */
export function DrivePlacementTab({ driveId, data }: { driveId: string; data: DrivePlacements }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [placing, setPlacing] = useState<DrivePlacementCandidate | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function place() {
    if (!placing) return;
    const candidate = placing;
    startTransition(async () => {
      const result = await updateApplicationStage({
        applicationId: candidate.applicationId,
        stageId: candidate.stageId,
        status: "SELECTED",
        note: "Placed from the drive's Placement tab",
      });
      setPlacing(null);
      if (!result.success) {
        toast({ title: "Could not place the student", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: `${candidate.studentName} placed`, description: `Placement recorded at ${data.companyName}.` });
      router.refresh();
    });
  }

  function revoke(placementId: string) {
    startTransition(async () => {
      const result = await revokePlacement({ placementId, reason });
      if (!result.success) {
        toast({ title: "Could not revoke", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Placement revoked", description: "The record is kept, with your reason." });
      setRevoking(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div>
          <h3 className="section-title" style={{ margin: 0 }}>Ready to place</h3>
          <p className="text-secondary" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Applicants at the Offer stage. Placing a student selects them and permanently excludes them from future
            placement drives; their applications and history are kept.
          </p>
        </div>

        {data.candidates.length === 0 ? (
          <div className="text-muted" style={{ fontSize: 13 }}>
            No one is at the Offer stage right now. Move applicants there from the Applications tab.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Stage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.candidates.map((candidate) => (
                  <tr key={candidate.applicationId}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{candidate.studentName}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{candidate.rollNumber}</div>
                      {candidate.alreadyPlaced && (
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>Already placed elsewhere</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{candidate.stageName}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11 }}
                        disabled={isPending}
                        onClick={() => setPlacing(candidate)}
                      >
                        Place…
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Placements from this drive</h3>
        {data.placements.length === 0 ? (
          <div className="text-muted" style={{ fontSize: 13 }}>No placements from this drive yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Role</th>
                  <th>Package</th>
                  <th>Placed on</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.placements.map((placement) => (
                  <tr key={placement.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{placement.studentName}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{placement.rollNumber}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{placement.roleName}</td>
                    <td style={{ fontSize: 12 }}>{placement.packageDisplay ?? "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      {new Date(placement.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {placement.recordedBy && <div className="text-muted" style={{ fontSize: 11 }}>by {placement.recordedBy}</div>}
                    </td>
                    <td>
                      {placement.revokedAt ? (
                        <>
                          <span className="badge badge-red" style={{ fontSize: 11 }}>Revoked</span>
                          {placement.revokeReason && (
                            <div className="text-muted" style={{ fontSize: 11 }}>{placement.revokeReason}</div>
                          )}
                        </>
                      ) : (
                        <span className="badge badge-green" style={{ fontSize: 11 }}>Placed</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", minWidth: 200 }}>
                      {!placement.revokedAt &&
                        (revoking === placement.id ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            <input
                              value={reason}
                              maxLength={1000}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Why is this being revoked? (required)"
                              aria-label="Revocation reason"
                              style={{ padding: "4px 6px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border-strong)" }}
                            />
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: 11 }}
                                disabled={isPending || reason.trim().length < 5}
                                onClick={() => revoke(placement.id)}
                              >
                                {isPending ? "Revoking…" : "Confirm revoke"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ fontSize: 11 }}
                                disabled={isPending}
                                onClick={() => {
                                  setRevoking(null);
                                  setReason("");
                                }}
                              >
                                Back
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: 11 }}
                            disabled={isPending}
                            onClick={() => setRevoking(placement.id)}
                          >
                            Revoke…
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted" style={{ fontSize: 12 }}>
          A placement made outside CampusHire is recorded from the student&apos;s record in{" "}
          <Link href="/admin-dashboard/students" style={{ color: "var(--accent)" }}>Students</Link>.
        </div>
      </div>

      <PlacementConfirmDialog
        open={placing !== null}
        onOpenChange={(next) => !next && setPlacing(null)}
        studentName={placing?.studentName ?? ""}
        companyName={data.companyName}
        roleName={data.roleName}
        packageText={data.packageDisplay}
        pending={isPending}
        onConfirm={place}
      />
    </div>
  );
}
