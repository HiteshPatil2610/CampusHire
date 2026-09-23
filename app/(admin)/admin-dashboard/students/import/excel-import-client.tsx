"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { commitImport } from "@/features/excel-import/actions/commit-import";
import {
  IMPORT_ERROR_TAGS,
  issueLabel,
  type ImportErrorTag,
  type ImportPreview,
  type RejectedRow,
} from "@/features/excel-import/schemas/import";
import { ERROR_SHEET_COLUMNS, errorSheetRows } from "@/features/excel-import/validator/error-sheet";
import { rowsToCsv } from "@/lib/csv-format";
import { downloadCsv } from "@/lib/csv-export";

type State = "idle" | "uploading" | "preview" | "committing" | "done";

interface ExcelImportClientProps {
  departmentCode: string;
}

/** Download the held rows as a sheet the preparer can correct and re-upload. */
function exportErrorSheet(rejected: RejectedRow[], departmentCode: string) {
  const csv = rowsToCsv(errorSheetRows(rejected), ERROR_SHEET_COLUMNS);
  downloadCsv(`campushire_import_errors_${departmentCode}`, csv);
}

/**
 * Every held row with all of its problems. A row can carry several tags;
 * filtering by a tag shows each row that has it.
 */
function ErrorReview({
  rejected,
  departmentCode,
}: {
  rejected: RejectedRow[];
  departmentCode: string;
}) {
  const [tagFilter, setTagFilter] = useState<ImportErrorTag | "ALL">("ALL");

  const tagCounts = useMemo(() => {
    const counts = new Map<ImportErrorTag, number>();
    for (const row of rejected) {
      for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  }, [rejected]);

  const visible =
    tagFilter === "ALL" ? rejected : rejected.filter((row) => row.tags.includes(tagFilter));

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ color: "var(--red)" }}>
            {rejected.length} row{rejected.length === 1 ? "" : "s"} held back
          </strong>
          <p className="text-secondary" style={{ fontSize: 12, margin: "4px 0 0", maxWidth: 560 }}>
            These rows are not imported. Export the error sheet, correct the rows in it, and
            upload it again — the extra columns are ignored.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => exportErrorSheet(rejected, departmentCode)}
        >
          Export Error Sheet
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }} role="group" aria-label="Filter by error">
        <button
          type="button"
          className={`badge ${tagFilter === "ALL" ? "badge-accent" : "badge-gray"}`}
          style={{ cursor: "pointer", border: "none" }}
          aria-pressed={tagFilter === "ALL"}
          onClick={() => setTagFilter("ALL")}
        >
          All ({rejected.length})
        </button>
        {[...tagCounts].map(([tag, count]) => (
          <button
            key={tag}
            type="button"
            className={`badge ${tagFilter === tag ? "badge-accent" : "badge-gray"}`}
            style={{ cursor: "pointer", border: "none" }}
            aria-pressed={tagFilter === tag}
            onClick={() => setTagFilter(tag)}
          >
            {IMPORT_ERROR_TAGS[tag]} ({count})
          </button>
        ))}
      </div>

      <div className="table-wrap" style={{ maxHeight: 420, overflow: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Row #</th>
              <th>Name</th>
              <th>Roll No.</th>
              <th>Email</th>
              <th>Error Tags</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.rowNumber}>
                <td>#{row.rowNumber}</td>
                <td>{row.values.name || <span className="text-muted">—</span>}</td>
                <td>{row.values.rollNumber || <span className="text-muted">—</span>}</td>
                <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.values.email || <span className="text-muted">—</span>}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {row.issues
                      .map((issue) => issueLabel(issue))
                      .filter((label, index, labels) => labels.indexOf(label) === index)
                      .map((label) => (
                        <span key={label} className="badge badge-red" style={{ fontSize: 10 }}>
                          {label}
                        </span>
                      ))}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    {row.issues.map((issue) => issue.message).join("; ")}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ExcelImportClient({ departmentCode }: ExcelImportClientProps) {
  const { toast } = useToast();
  const [state, setState] = useState<State>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<{ count: number; rejected: RejectedRow[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function downloadTemplate() {
    try {
      const response = await fetch("/api/admin/students/import/template");
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campushire_import_template_${departmentCode}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", description: "Could not download template.", variant: "destructive" });
    }
  }

  async function handleFile(file: File) {
    setState("uploading");
    setFileInfo({ name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/students/import", { method: "POST", body: formData });
      const body = await response.json();
      if (!response.ok) {
        toast({ title: "Upload failed", description: body.error, variant: "destructive" });
        reset();
        return;
      }
      setPreview(body as ImportPreview);
      setState("preview");
    } catch {
      toast({ title: "Upload failed", description: "Network error. Please try again.", variant: "destructive" });
      reset();
    }
  }

  function handleCommit() {
    if (!preview) return;
    setState("committing");
    startTransition(async () => {
      const outcome = await commitImport({ blobUrl: preview.blobUrl, fileName: preview.fileName });

      if (outcome.success) {
        setResult({ count: outcome.count, rejected: outcome.rejected });
        setState("done");
        toast({
          title: "Import complete",
          description: `${outcome.count} student${outcome.count === 1 ? "" : "s"} added to ${outcome.departmentCode}.`,
        });
      } else {
        setState("preview");
        toast({ title: "Import failed", description: outcome.error, variant: "destructive" });
      }
    });
  }

  function reset() {
    setState("idle");
    setFileInfo(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (state === "done" && result) {
    return (
      <div>
        <div className="card" style={{ padding: 32, textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            {result.count} student{result.count === 1 ? "" : "s"} imported
          </h2>
          <p className="text-secondary" style={{ fontSize: 13, marginBottom: 20 }}>
            They are marked &ldquo;Pending registration&rdquo; until they sign up with their MIS
            number.
            {result.rejected.length > 0 &&
              ` ${result.rejected.length} row${result.rejected.length === 1 ? " was" : "s were"} held back — see below.`}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/admin-dashboard/students" className="btn btn-primary">
              View Students →
            </Link>
            <button type="button" className="btn btn-outline" onClick={reset}>
              Import another file
            </button>
          </div>
        </div>
        {result.rejected.length > 0 && (
          <ErrorReview rejected={result.rejected} departmentCode={departmentCode} />
        )}
      </div>
    );
  }

  if (state === "idle" || state === "uploading") {
    return (
      <div>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <p className="text-secondary" style={{ fontSize: 12, margin: 0 }}>
            Columns: MIS NO., PRN NO., NAME, EMAIL, PH. NO., ROLL NO., DEPT, BATCH
            (e.g. 2027 or 2023-27), and optionally DIPLOMA (1 for lateral entry).
          </p>
          <button type="button" className="btn btn-outline" onClick={downloadTemplate}>
            Download Template
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {state === "uploading" ? (
          <div className="card" style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontWeight: 500 }}>Validating file…</p>
            <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
              Checking every row for missing fields, formats and duplicates
            </p>
          </div>
        ) : (
          <div
            className={`dropzone ${dragOver ? "dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: "pointer", padding: "40px 20px", textAlign: "center" }}
          >
            <p style={{ marginTop: 12, fontWeight: 500, fontSize: 15 }}>
              Drag & drop your Excel or CSV file here, or click to browse
            </p>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              Supported: .xlsx, .xls, .csv (max 5 MB)
            </p>
          </div>
        )}
      </div>
    );
  }

  if (preview) {
    const clean = preview.ready.length;
    const held = preview.rejected.length;
    const committing = state === "committing" || isPending;

    return (
      <div>
        <div
          className="card"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "12px 16px" }}
        >
          <div>
            <strong>{fileInfo?.name}</strong>
            <div className="text-muted" style={{ fontSize: 11 }}>
              {fileInfo?.size} · {preview.totalRows} row{preview.totalRows === 1 ? "" : "s"}
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={reset} disabled={committing}>
            Choose another file
          </button>
        </div>

        {held > 0 && <ErrorReview rejected={preview.rejected} departmentCode={departmentCode} />}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
            <span>
              <strong style={{ color: "var(--teal)" }}>{clean}</strong> ready to import
            </span>
            {held > 0 && (
              <span>
                <strong style={{ color: "var(--red)" }}>{held}</strong> held back
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={reset} disabled={committing}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={clean === 0 || committing} onClick={handleCommit}>
              {committing
                ? "Importing…"
                : clean === 0
                  ? "No clean rows to import"
                  : `Import ${clean} clean row${clean === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
