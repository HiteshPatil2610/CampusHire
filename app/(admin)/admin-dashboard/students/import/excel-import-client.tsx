"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { commitImport } from "@/features/excel-import/actions/commit-import";
import type { ValidationResult, ParsedRow } from "@/features/excel-import/schemas/import";
import StatusBadge from "@/components/ui/status-badge";
import Link from "next/link";

type State = 'idle' | 'uploading' | 'preview' | 'committing' | 'success' | 'error';

interface ExcelImportClientProps {
  departmentCode: string;
  departmentId: string;
}

export function ExcelImportClient({ departmentCode, departmentId }: ExcelImportClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<State>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult & { blobUrl: string } | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function downloadTemplate() {
    try {
      const response = await fetch('/api/admin/students/import/template');
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campushire_import_template_${departmentCode}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not download template.', variant: 'destructive' });
    }
  }

  async function handleFile(file: File) {
    setState('uploading');
    setFileInfo({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/admin/students/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        toast({ title: 'Upload failed', description: result.error, variant: 'destructive' });
        setState('idle');
        setFileInfo(null);
        return;
      }

      setValidationResult(result);
      setState('preview');
    } catch {
      toast({ title: 'Upload failed', description: 'Network error. Please try again.', variant: 'destructive' });
      setState('idle');
      setFileInfo(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  }

  async function handleCommit() {
    if (!validationResult) return;
    
    setState('committing');
    startTransition(async () => {
      const result = await commitImport({
        blobUrl: validationResult.blobUrl,
        fileName: validationResult.fileName,
      });

      if (result.success) {
        setSuccessCount(result.count);
        setState('success');
        toast({ 
          title: 'Import complete', 
          description: `${result.count} students enrolled into ${result.departmentCode} department.` 
        });
      } else {
        setState('error');
        toast({ 
          title: 'Import failed', 
          description: result.error, 
          variant: 'destructive' 
        });
      }
    });
  }

  function reset() {
    setState('idle');
    setFileInfo(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  if (state === 'success') {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Import Complete!</h2>
        <p className="text-secondary" style={{ marginBottom: 8 }}>
          {successCount} students enrolled into {departmentCode} department.
        </p>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 24 }}>
          Students are marked as &ldquo;Pending Registration&rdquo; until they sign up.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/admin-dashboard/students" className="btn btn-primary">
            View Students →
          </Link>
          <button type="button" className="btn btn-outline" onClick={reset}>
            Import another file
          </button>
        </div>
      </div>
    );
  }

  if (state === 'idle' || state === 'uploading') {
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={downloadTemplate}>
            📄 Download Template
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {state === 'uploading' ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <p style={{ fontWeight: 500 }}>Validating file...</p>
            <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
              Parsing and checking for errors
            </p>
          </div>
        ) : (
          <div
            className={`dropzone ${dragOver ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer', padding: '40px 20px', textAlign: 'center' }}
          >
            <div style={{ fontSize: 36 }}>📊</div>
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

  if (state === 'preview' && validationResult) {
    const hasErrors = validationResult.errors.length > 0 || validationResult.duplicates.length > 0;
    
    return (
      <div>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>📄</span>
            <div>
              <strong>{fileInfo?.name}</strong>
              <div className="text-muted" style={{ fontSize: 11 }}>
                {fileInfo?.size} · {validationResult.totalRows} records
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={reset}>
            Choose another file
          </button>
        </div>

        {hasErrors && (
          <div className="card" style={{ marginBottom: 16, padding: 16, background: 'var(--red-light)', border: '1px solid var(--red)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>⚠</span>
              <strong style={{ color: 'var(--red)' }}>Import blocked — {validationResult.invalidRows} row(s) have errors</strong>
            </div>
            
            <div className="table-wrap" style={{ maxHeight: 300, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Field</th>
                    <th>Value</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResult.errors.map((err, idx) => (
                    <tr key={idx}>
                      <td>#{err.row}</td>
                      <td><code>{err.field}</code></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{err.value}</td>
                      <td style={{ color: 'var(--red)' }}>{err.error}</td>
                    </tr>
                  ))}
                  {validationResult.duplicates.map((dup, idx) => (
                    <tr key={`dup-${idx}`}>
                      <td>#{dup.row}</td>
                      <td><code>{dup.field}</code></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dup.value}</td>
                      <td style={{ color: 'var(--red)' }}>
                        {dup.existsInDatabase 
                          ? 'Already exists in database' 
                          : `Duplicate of row #${dup.duplicateRow}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
            <span>
              <strong style={{ color: 'var(--teal)' }}>{validationResult.validRows}</strong> valid
            </span>
            {validationResult.invalidRows > 0 && (
              <span>
                <strong style={{ color: 'var(--red)' }}>{validationResult.invalidRows}</strong> invalid
              </span>
            )}
            <span className="text-secondary">
              <strong>{validationResult.totalRows}</strong> total
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={reset}>
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={!validationResult.canImport || isPending}
              onClick={handleCommit}
            >
              {isPending 
                ? 'Importing...' 
                : `Confirm & Import ${validationResult.validRows} Students`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
