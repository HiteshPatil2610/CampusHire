"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv } from "@/lib/csv-export";
import { exportDriveDataset } from "../actions/export-drive-dataset";
import { DATASET_LABELS, EXPORT_DATASETS, type ExportDataset } from "../domain/export-datasets";

interface ExportMenuProps {
  driveId: string;
  /** The datasets this viewer may ask for; the server checks again. */
  datasets?: readonly ExportDataset[];
  /** Super Admin only: narrows the export to one department. */
  departmentId?: string;
}

/**
 * Export a whole dataset of a drive.
 *
 * Unlike the per-table export, which writes what is on screen (one page),
 * this asks the server for the full dataset. The server checks who is
 * asking, that the drive is theirs and which columns the dataset allows, so
 * the menu only chooses a dataset by name. It shows what is happening — a
 * busy state while the file is built, and a plain message when there is
 * nothing to export or the request is refused.
 */
export function ExportMenu({ driveId, datasets = EXPORT_DATASETS, departmentId }: ExportMenuProps) {
  const { toast } = useToast();
  const [dataset, setDataset] = useState<ExportDataset>(datasets[0] ?? "applicants");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await exportDriveDataset({ driveId, dataset, departmentId });
      if (!result.success) {
        toast({ title: "Export failed", description: result.error, variant: "destructive" });
        return;
      }
      if (result.rowCount === 0) {
        toast({
          title: "Nothing to export",
          description: `There are no rows in “${DATASET_LABELS[dataset]}” for this drive yet.`,
        });
        return;
      }
      downloadCsv(result.filename, result.csv);
      toast({
        title: "Export ready",
        description: `${result.rowCount} row${result.rowCount === 1 ? "" : "s"} saved as ${result.filename}.csv.`,
      });
    } catch {
      toast({
        title: "Export failed",
        description: "The export could not be built. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <label className="text-secondary" style={{ fontSize: 12 }} htmlFor={`export-${driveId}`}>
        Export
      </label>
      <select
        id={`export-${driveId}`}
        className="input"
        style={{ maxWidth: 240 }}
        value={dataset}
        disabled={busy}
        onChange={(e) => setDataset(e.target.value as ExportDataset)}
      >
        {datasets.map((value) => (
          <option key={value} value={value}>
            {DATASET_LABELS[value]}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void run()}>
        {busy ? "Preparing…" : "Download CSV"}
      </button>
    </div>
  );
}
