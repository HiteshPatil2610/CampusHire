import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi, type ImportPreviewResponse } from '@/api/admin'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import ConfirmModal from '@/components/common/ConfirmModal'
import { ChevronLeft, Upload, FileSpreadsheet, Download, CheckCircle, XCircle, Loader2 } from 'lucide-react'

type Stage = 'idle' | 'previewing' | 'preview_ready' | 'importing' | 'done'

export default function ExcelUpload() {
  const navigate = useNavigate()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [file,     setFile]    = useState<File | null>(null)
  const [preview,  setPreview] = useState<ImportPreviewResponse | null>(null)
  const [stage,    setStage]   = useState<Stage>('idle')
  const [confirm,  setConfirm] = useState(false)
  const [result,   setResult]  = useState<{ imported_count: number; failed_count: number; message: string } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.csv')) {
      toast.error('Please upload an .xlsx or .csv file')
      return
    }
    setFile(f)
    setPreview(null)
    setStage('idle')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setPreview(null); setStage('idle') }
  }

  const handlePreview = async () => {
    if (!file) return
    setStage('previewing')
    try {
      const res = await adminApi.previewImport(file)
      setPreview(res.data)
      setStage('preview_ready')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to parse file'))
      setStage('idle')
    }
  }

  const handleImport = async () => {
    if (!file) return
    setConfirm(false)
    setStage('importing')
    try {
      const res = await adminApi.confirmImport(file)
      setResult(res.data)
      setStage('done')
      toast.success(res.data.message)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Import failed'))
      setStage('preview_ready')
    }
  }

  const downloadTemplate = () => {
    const csv = 'full_name,email,roll_number,phone,department_code,year,semester\nAditi Sharma,aditi@college.edu,CS0142,9876543210,CSE,4,7'
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'student_import_template.csv'; a.click()
  }

  const validRows   = preview?.preview.filter(r => r.status === 'valid')   ?? []
  const invalidRows = preview?.preview.filter(r => r.status === 'error')   ?? []

  return (
    <div className="max-w-2xl anim-fade-up">
      <Link to="/admin/students" className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary mb-5 transition-colors">
        <ChevronLeft size={14} /> Back to students
      </Link>

      <h1 className="text-xl font-semibold text-text-primary mb-1">Import students via Excel</h1>
      <p className="text-xs text-text-secondary mb-6">Upload an Excel (.xlsx) or CSV file. We'll validate it and show a preview before importing.</p>

      {stage === 'done' && result ? (
        /* ── Success screen ── */
        <div className="bg-teal-light border border-teal/20 rounded-xl p-8 text-center space-y-3">
          <CheckCircle size={40} className="text-teal mx-auto" />
          <p className="text-base font-semibold text-teal">Import complete!</p>
          <p className="text-sm text-text-secondary">{result.message}</p>
          <div className="flex justify-center gap-4 text-sm mt-2">
            <span className="text-teal font-medium">{result.imported_count} imported</span>
            {result.failed_count > 0 && <span className="text-danger font-medium">{result.failed_count} failed</span>}
          </div>
          <div className="flex justify-center gap-3 pt-3">
            <Link to="/admin/students">
              <Button variant="primary" size="sm">View students</Button>
            </Link>
            <Button size="sm" onClick={() => { setStage('idle'); setFile(null); setPreview(null); setResult(null) }}>
              Import more
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Download template */}
          <div className="flex items-center justify-between p-4 bg-surface-1 border border-border rounded-xl">
            <div>
              <p className="text-sm font-medium text-text-primary">Download template</p>
              <p className="text-xs text-text-secondary mt-0.5">Columns: full_name, email, roll_number, phone, department_code, year, semester</p>
            </div>
            <Button size="sm" icon={<Download size={13} />} onClick={downloadTemplate}>Template</Button>
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border-strong rounded-xl p-10 text-center cursor-pointer hover:border-accent hover:bg-accent-light/30 transition-all duration-200"
          >
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFileChange} className="hidden" />
            <Upload size={28} className="text-text-muted mx-auto mb-3" />
            {file ? (
              <>
                <p className="text-sm font-medium text-text-primary flex items-center justify-center gap-2">
                  <FileSpreadsheet size={16} className="text-teal" /> {file.name}
                </p>
                <p className="text-xs text-text-muted mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">Drag & drop your file here, or <span className="text-accent">browse</span></p>
                <p className="text-xs text-text-muted mt-1">Supports .xlsx and .csv</p>
              </>
            )}
          </div>

          {/* Validate button */}
          {file && stage === 'idle' && (
            <Button variant="primary" size="md" className="w-full" onClick={handlePreview}>
              Validate file
            </Button>
          )}

          {stage === 'previewing' && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-text-secondary">
              <Loader2 size={16} className="animate-spin text-accent" /> Validating…
            </div>
          )}

          {/* Preview results */}
          {stage === 'preview_ready' && preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-1 rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-text-primary">{preview.total_rows}</p>
                  <p className="text-xs text-text-muted mt-0.5">Total rows</p>
                </div>
                <div className="bg-teal-light rounded-lg p-3 text-center">
                  <p className="text-lg font-semibold text-teal">{preview.valid_rows}</p>
                  <p className="text-xs text-teal/70 mt-0.5">Valid</p>
                </div>
                <div className={`${preview.invalid_rows > 0 ? 'bg-danger-light' : 'bg-surface-1'} rounded-lg p-3 text-center`}>
                  <p className={`text-lg font-semibold ${preview.invalid_rows > 0 ? 'text-danger' : 'text-text-primary'}`}>{preview.invalid_rows}</p>
                  <p className={`text-xs mt-0.5 ${preview.invalid_rows > 0 ? 'text-danger/70' : 'text-text-muted'}`}>Errors</p>
                </div>
              </div>

              {/* Error rows */}
              {invalidRows.length > 0 && (
                <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-danger-light">
                    <p className="text-xs font-semibold text-danger">Rows with errors (will be skipped)</p>
                  </div>
                  <table className="ch-table">
                    <thead><tr><th>Row</th><th>Email</th><th>Roll no.</th><th>Error</th></tr></thead>
                    <tbody>
                      {invalidRows.map(r => (
                        <tr key={r.row_number}>
                          <td className="text-text-muted">{r.row_number}</td>
                          <td>{r.email ?? '—'}</td>
                          <td>{r.roll_number ?? '—'}</td>
                          <td className="text-danger text-xs">{r.error_message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                {preview.valid_rows > 0 ? (
                  <Button
                    variant="primary" size="md"
                    icon={<CheckCircle size={14} />}
                    onClick={() => setConfirm(true)}
                    className="flex-1"
                  >
                    Import {preview.valid_rows} valid row{preview.valid_rows !== 1 ? 's' : ''}
                  </Button>
                ) : (
                  <div className="flex-1 text-center text-xs text-danger bg-danger-light border border-danger/20 rounded-lg py-2.5">
                    No valid rows to import. Fix the errors and re-upload.
                  </div>
                )}
                <Button size="md" onClick={() => { setStage('idle'); setPreview(null); setFile(null) }}>
                  Re-upload
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirm}
        title={`Import ${preview?.valid_rows} students?`}
        message="Each student will receive a temporary password by email. Rows with errors will be skipped."
        confirmLabel="Confirm import"
        confirmVariant="primary"
        onConfirm={handleImport}
        onCancel={() => setConfirm(false)}
        loading={stage === 'importing'}
      />
    </div>
  )
}
