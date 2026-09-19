"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DriveDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Drive detail error:", error);
  }, [error]);

  return (
    <div
      style={{
        padding: "60px 32px",
        maxWidth: 600,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
        Could not load this drive
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          marginBottom: 24,
        }}
      >
        Something went wrong fetching this drive. It may have been removed or
        you may no longer be eligible for it.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/student-dashboard/drives" className="btn btn-outline">
          ← Back to Drives
        </Link>
      </div>
    </div>
  );
}
