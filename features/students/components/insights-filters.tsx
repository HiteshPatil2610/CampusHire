"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { batchLabel } from "@/features/students/utils/batch";

/**
 * Batch and semester filters for Department Insights (Phase 9, Item 20).
 * Both are URL params, so the server component re-fetches with them applied
 * consistently to every metric — there is no client-side recomputation that
 * could drift from what the page's numbers actually show.
 */
export function InsightsFilters({
  availableBatches,
  availableSemesters,
}: {
  availableBatches: number[];
  availableSemesters: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentBatch = searchParams.get("batch") ?? "";
  const currentSemester = searchParams.get("semester") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Batch:{" "}
        <select
          value={currentBatch}
          onChange={(e) => setParam("batch", e.target.value)}
          style={{ fontSize: 12, padding: "4px 6px" }}
        >
          <option value="">All batches</option>
          {availableBatches.map((year) => (
            <option key={year} value={year}>
              {batchLabel(year)}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Semester:{" "}
        <select
          value={currentSemester}
          onChange={(e) => setParam("semester", e.target.value)}
          style={{ fontSize: 12, padding: "4px 6px" }}
        >
          <option value="">All semesters</option>
          {availableSemesters.map((semester) => (
            <option key={semester} value={semester}>
              Semester {semester}
            </option>
          ))}
        </select>
      </label>

      {(currentBatch || currentSemester) && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
          onClick={() => router.push(pathname)}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
