"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The confirmation before a student is placed.
 *
 * Selecting an application creates a permanent placement: the student is
 * excluded from every future placement drive, and it can only be corrected by
 * revoking it with a reason. This dialog says so, shows exactly what will be
 * recorded, and makes the admin acknowledge it before anything is sent. The
 * server still decides — this is the human check, not a permission.
 */
export function PlacementConfirmDialog({
  open,
  onOpenChange,
  studentName,
  companyName,
  roleName,
  packageText,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  companyName: string;
  roleName: string;
  packageText: string | null;
  pending: boolean;
  onConfirm: () => void;
}) {
  const [understood, setUnderstood] = useState(false);

  // A fresh acknowledgement every time the dialog opens.
  useEffect(() => {
    if (open) setUnderstood(false);
  }, [open]);

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Place {studentName}?</DialogTitle>
          <DialogDescription>
            This selects the candidate and records a placement. It cannot be undone by editing.
          </DialogDescription>
        </DialogHeader>

        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", fontSize: 13, margin: 0 }}>
          <dt className="text-muted">Student</dt>
          <dd style={{ margin: 0 }}>{studentName}</dd>
          <dt className="text-muted">Company</dt>
          <dd style={{ margin: 0 }}>{companyName}</dd>
          <dt className="text-muted">Role</dt>
          <dd style={{ margin: 0 }}>{roleName}</dd>
          <dt className="text-muted">Package</dt>
          <dd style={{ margin: 0 }}>{packageText || "—"}</dd>
          <dt className="text-muted">Placement date</dt>
          <dd style={{ margin: 0 }}>{today}</dd>
        </dl>

        <ul className="text-secondary" style={{ fontSize: 12, margin: 0, paddingLeft: 18, display: "grid", gap: 3 }}>
          <li>The student is permanently excluded from future placement drives.</li>
          <li>Their applications and recruitment history are kept.</li>
          <li>The placement is audited. A mistake is corrected by revoking it, with a reason.</li>
        </ul>

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={understood}
            disabled={pending}
            onChange={(e) => setUnderstood(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>I understand this makes {studentName} placed.</span>
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={pending || !understood} onClick={onConfirm}>
            {pending ? "Placing…" : "Place student"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
