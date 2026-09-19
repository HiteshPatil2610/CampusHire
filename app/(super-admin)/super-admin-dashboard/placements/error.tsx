"use client";

import { useEffect } from "react";

export default function PlacementsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Placements page error:", error);
  }, [error]);

  return (
    <div className="card" role="alert" style={{ textAlign: "center", padding: 40, maxWidth: 500, margin: "0 auto" }}>
      <h2 style={{ fontSize: 16, marginBottom: 6 }}>Could not load placements</h2>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>Something went wrong while fetching placements.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
