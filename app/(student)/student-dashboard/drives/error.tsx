"use client";

import { useEffect } from "react";

export default function DrivesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Drives page error:", error);
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
      <h2 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 8 }}>
        Could not load drives
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          marginBottom: 24,
        }}
      >
        Something went wrong while fetching your eligible drives.
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
