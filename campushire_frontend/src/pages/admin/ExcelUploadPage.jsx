import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DEPT_ADMIN, EXCEL_ROWS } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';
import { useAppState } from '../../context/AppStateContext';
import { exportToCsv } from '../../utils/exportUtils';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';

export default function ExcelUploadPage() {
  const { user: authUser } = useAuth();
  const user = authUser || { name: DEPT_ADMIN.name, initials: 'DA' };
  const currentDept = user.department || DEPT_ADMIN.department;
  const navigate = useNavigate();

  const [dragOver, setDragOver] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [rows, setRows] = useState(EXCEL_ROWS);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { showToast } = useToast();
  const { addStudentsBatch } = useAppState();

  function validateAndProcessFile(file) {
    if (!file) return;

    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      showToast('Invalid file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.', 'error');
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      showToast('File exceeds 5MB limit. Please upload a smaller file.', 'error');
      return;
    }

    setFileInfo({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });

    // If it's a CSV, attempt to parse rows client-side
    if (file.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            const parsed = lines.slice(1).map((line, idx) => {
              const cols = line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
              const name = cols[0] || `Student ${idx + 1}`;
              const rollNo = cols[1] || `21CS${100 + idx}`;
              const email = cols[2] || `${name.toLowerCase().replace(/\s+/g, '.')}@college.edu`;
              const isValid = Boolean(name && rollNo && email.includes('@'));
              return {
                row: idx + 1,
                name,
                rollNo,
                email,
                valid: isValid,
                error: isValid ? null : 'Missing email or invalid roll number',
              };
            });
            setRows(parsed);
          }
        } catch {
          // Keep existing rows
        }
      };
      reader.readAsText(file);
    }

    showToast(`File "${file.name}" uploaded and validated.`, 'success');
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e) {
    if (e.target.files?.[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  }

  function downloadSampleTemplate() {
    const columns = [
      { key: 'name', label: 'Full Name' },
      { key: 'rollNo', label: 'Roll Number' },
      { key: 'email', label: 'College Email' },
      { key: 'cgpa', label: 'CGPA' },
      { key: 'department', label: 'Department' },
      { key: 'backlogs', label: 'Active Backlogs' },
    ];
    const sampleData = [
      { name: 'Aditi Sharma', rollNo: '21CS042', email: 'aditi.sharma@college.edu', cgpa: '8.7', department: 'CSE', backlogs: '0' },
      { name: 'Rohan Mehta', rollNo: '21CS089', email: 'rohan.mehta@college.edu', cgpa: '7.4', department: 'CSE', backlogs: '0' },
      { name: 'Priya Patel', rollNo: '21CS104', email: 'priya.patel@college.edu', cgpa: '6.2', department: 'CSE', backlogs: '1' },
    ];
    exportToCsv('campushire_student_import_template', columns, sampleData);
  }

  function removeRow(rowNum) {
    setRows((prev) => prev.filter((r) => r.row !== rowNum));
  }

  function handleCommitImport() {
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) {
      showToast('No valid rows to import.', 'error');
      return;
    }
    setImporting(true);
    setTimeout(() => {
      addStudentsBatch(
        validRows.map((r) => ({
          name: r.name,
          roll: r.roll || r.rollNo,
          email: r.email,
          dept: currentDept,
          cgpa: r.cgpa || 7.5,
          year: '4th',
        }))
      );
      setImporting(false);
      showToast(`Successfully enrolled ${validRows.length} students into the ${currentDept} placement system!`, 'success');
      setFileInfo(null);
      navigate(PATHS.adminDashboard);
    }, 700);
  }

  return (
    <AppShell role="admin" user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Bulk Student Import</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            Import students into the departmental placement database via Excel or CSV.
          </p>
        </div>
        <Button variant="outline" onClick={downloadSampleTemplate}>
          📄 Download Template (.csv)
        </Button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {!fileInfo ? (
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
            Drag & drop your Excel or CSV spreadsheet here, or click to browse
          </p>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Supported formats: .xlsx, .xls, .csv (Max 5 MB)
          </p>
        </div>
      ) : (
        <>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📄</span>
              <div>
                <strong>{fileInfo.name}</strong>
                <div className="text-muted" style={{ fontSize: 11 }}>{fileInfo.size} · Parsed {rows.length} records</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose another file
            </Button>
          </div>

          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Roll No</th>
                  <th>Email</th>
                  <th>Validation</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row}>
                    <td>#{r.row}</td>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.rollNo}</td>
                    <td>{r.email}</td>
                    <td>
                      <Badge variant={r.valid ? 'green' : 'red'}>
                        {r.valid ? 'Valid' : r.error}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)', fontSize: 11 }}
                        onClick={() => removeRow(r.row)}
                        title="Remove row"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Ready to import: <strong>{rows.filter((r) => r.valid).length}</strong> of {rows.length} rows
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="outline" onClick={() => setFileInfo(null)}>
                Cancel
              </Button>
              <Button disabled={importing || rows.filter((r) => r.valid).length === 0} onClick={handleCommitImport}>
                {importing ? 'Importing...' : `Confirm & Import ${rows.filter((r) => r.valid).length} Students`}
              </Button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
