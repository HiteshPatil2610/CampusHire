"use client";

import { useEffect } from "react";

export default function AdminDrivesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin drives page error:", error);
  }, [error]);

  return (
    <div className="card" style={{ textAlign: "center", padding: 40 }}>
      <h2 style={{ fontSize: 16, marginBottom: 6 }}>Could not load drives</h2>
      <p
        className="text-muted"
        style={{ fontSize: 13, marginBottom: 16 }}
      >
        Something went wrong while fetching this page.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
