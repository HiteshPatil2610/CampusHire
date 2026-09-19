"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DriveWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Drive workspace error:", error);
  }, [error]);

  return (
    <div className="card" role="alert" style={{ textAlign: "center", padding: 40, maxWidth: 500, margin: "0 auto" }}>
      <h2 style={{ fontSize: 16, marginBottom: 6 }}>Could not load this drive</h2>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Something went wrong while loading the drive. Your changes so far are saved.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/admin-dashboard/drives" className="btn btn-outline">
          ← Back to Drives
        </Link>
      </div>
    </div>
  );
}
