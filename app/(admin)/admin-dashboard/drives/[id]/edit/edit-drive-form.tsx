"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateDrive } from "@/features/drives/actions/update-drive";
import { AdminDriveLogisticsPanel } from "@/components/admin/drives/admin-drive-logistics-panel";
import {
  AdminApplicationFieldsPanel,
  type ApplicationFieldConfig,
} from "@/components/admin/drives/admin-application-fields-panel";
import { AdminDrivePreviewCard } from "@/components/admin/drives/admin-drive-preview-card";
import DatePicker from "@/components/ui/date-picker";
import UrlField from "@/components/ui/url-field";
import { useToast } from "@/hooks/use-toast";
import { BatchTargetingPicker } from "@/features/drives/components/batch-targeting-picker";
import type { DepartmentBatchYear } from "@/features/students/queries/department-batch-years";
import { eligibleDepartmentIdsOf } from "@/features/drives/utils/eligible-departments";
import type { HasEligibleDepartmentLinks } from "@/features/drives/utils/eligible-departments";
import type { WithSerializedPackage } from "@/features/drives/utils/serialize-drive";
import type { Drive } from "@prisma/client";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface EditDriveFormProps {
  driveId: string;
  drive: WithSerializedPackage<Drive & HasEligibleDepartmentLinks>;
  departmentId: string;
  departmentCode: string;
  allDepartments: Department[];
  /** Batch years this department's students have. */
  batchYears: DepartmentBatchYear[];
  /** The batches the drive targets today. */
  initialBatches: string[];
}

export function EditDriveForm({
  driveId,
  drive,
  departmentId,
  departmentCode,
  allDepartments,
  batchYears,
  initialBatches,
}: EditDriveFormProps) {
  const router = useRouter();
  const [selectedBatches, setSelectedBatches] = useState<string[]>(initialBatches);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Parse JSON fields
  const parsedRounds = JSON.parse(drive.selectionRounds);
  const parsedEligibleDepts = eligibleDepartmentIdsOf(drive);
  const parsedApplicationFields = drive.applicationFields
    ? JSON.parse(drive.applicationFields)
    : [];

  const [form, setForm] = useState({
    companyName: drive.companyName,
    roleName: drive.roleName,
    packageOffered: String(drive.packageOffered),
    packageDisplay: drive.packageDisplay || "",
    jobDescriptionUrl: drive.jobDescriptionUrl || "",
    minCGPA: String(drive.minCGPA),
    maxActiveBacklogs: String(drive.maxActiveBacklogs),
    eligibleDepartments: parsedEligibleDepts,
    driveDate: drive.driveDate.toISOString().split("T")[0],
    applicationDeadline: drive.applicationDeadline.toISOString().split("T")[0],
    applyMethod: drive.applyMethod as "IN_APP" | "EXTERNAL",
    externalApplyUrl: drive.externalApplyUrl || "",
    selectionRounds: parsedRounds,
    venue: drive.venue || "",
    reportingTime: drive.reportingTime || "",
    contactPerson: drive.contactPerson || "",
    contactPhone: drive.contactPhone || "",
    pptLink: drive.pptLink || "",
  });

  const [applicationFields, setApplicationFields] = useState<ApplicationFieldConfig[]>(
    parsedApplicationFields
  );
  const [roundInput, setRoundInput] = useState("");

  function handleLogisticsChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddRound() {
    if (!roundInput.trim()) return;
    setForm((prev) => ({
      ...prev,
      selectionRounds: [...prev.selectionRounds, roundInput.trim()],
    }));
    setRoundInput("");
  }

  function handleRemoveRound(index: number) {
    setForm((prev) => ({
      ...prev,
      selectionRounds: prev.selectionRounds.filter((_: string, i: number) => i !== index),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.companyName.trim() || !form.roleName.trim()) {
      toast({
        title: "Error",
        description: "Company name and role are required",
        variant: "destructive",
      });
      return;
    }

    const packageNum = parseFloat(form.packageOffered);
    if (isNaN(packageNum) || packageNum <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid package amount",
        variant: "destructive",
      });
      return;
    }

    const deadline = new Date(form.applicationDeadline);
    const driveDate = new Date(form.driveDate);

    if (deadline >= driveDate) {
      toast({
        title: "Error",
        description: "Application deadline must be before drive date",
        variant: "destructive",
      });
      return;
    }

    if (form.applyMethod === "EXTERNAL" && !form.externalApplyUrl.trim()) {
      toast({
        title: "Error",
        description: "External apply URL is required",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await updateDrive(driveId, {
        companyName: form.companyName.trim(),
        roleName: form.roleName.trim(),
        packageOffered: packageNum,
        packageDisplay: form.packageDisplay.trim() || undefined,
        jobDescriptionUrl: form.jobDescriptionUrl.trim() || undefined,
        minCGPA: parseFloat(form.minCGPA),
        maxActiveBacklogs: parseInt(form.maxActiveBacklogs, 10),
        batchYears: selectedBatches,
        eligibleDepartments: form.eligibleDepartments,
        driveDate: form.driveDate,
        applicationDeadline: form.applicationDeadline,
        applyMethod: form.applyMethod,
        externalApplyUrl: form.externalApplyUrl.trim() || undefined,
        selectionRounds: form.selectionRounds,
        venue: form.venue.trim() || undefined,
        reportingTime: form.reportingTime.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        pptLink: form.pptLink.trim() || undefined,
        applicationFields: applicationFields.length > 0 ? JSON.stringify(applicationFields) : undefined,
      });

      if (result.success) {
        toast({
          title: "Drive updated!",
          description: "Drive details updated successfully.",
        });
        router.push("/admin-dashboard/drives");
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update drive",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Same sections as PostDriveForm but pre-populated */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Company & Role Details</h3>
        
        <div className="field-row">
          <div className="field">
            <label>Company Name *</label>
            <input
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Role / Job Title *</label>
            <input
              required
              value={form.roleName}
              onChange={(e) => setForm({ ...form, roleName: e.target.value })}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Package Offered (in LPA) *</label>
            <input
              required
              type="number"
              step="0.01"
              value={form.packageOffered}
              onChange={(e) => setForm({ ...form, packageOffered: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Package Display (optional)</label>
            <input
              value={form.packageDisplay}
              onChange={(e) => setForm({ ...form, packageDisplay: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label>Job Description URL (optional)</label>
          <UrlField
            value={(form.jobDescriptionUrl || "").replace(/^https?:\/\//i, "")}
            onChange={(val: string) =>
              setForm({
                ...form,
                jobDescriptionUrl: val ? (val.startsWith("http") ? val : `https://${val}`) : "",
              })
            }
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Eligibility Criteria</h3>

        <div className="field-row">
          <div className="field">
            <label>Minimum CGPA *</label>
            <input required type="number" step="0.01" value={form.minCGPA} onChange={(e) => setForm({ ...form, minCGPA: e.target.value })} />
          </div>
          <div className="field">
            <label>Max Active Backlogs *</label>
            <input required type="number" value={form.maxActiveBacklogs} onChange={(e) => setForm({ ...form, maxActiveBacklogs: e.target.value })} />
          </div>
        </div>

        <div className="field">
          <label>Eligible Batches *</label>
          <BatchTargetingPicker
            available={batchYears}
            selected={selectedBatches}
            onChange={setSelectedBatches}
          />
        </div>

        <div className="field">
          <label>Eligible Departments *</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginTop: 8 }}>
            {allDepartments.map((dept) => {
              const isOwnDept = dept.id === departmentId;

              return (
                <label
                  key={dept.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: isOwnDept ? "var(--accent-light)" : "var(--surface-1)",
                    border: "0.5px solid var(--border)",
                    borderRadius: 6,
                    cursor: "not-allowed",
                    opacity: isOwnDept ? 1 : 0.5,
                  }}
                >
                  <input type="checkbox" checked={isOwnDept} disabled readOnly />
                  <span style={{ fontSize: 13 }}>{dept.code}</span>
                </label>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
            A department drive reaches your own department only. To open a drive
            to several departments, ask the Super Admin to post a central drive.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Dates & Application Method</h3>

        <div className="field-row">
          <div className="field">
            <label>Drive Date *</label>
            <DatePicker 
              value={form.driveDate ? new Date(form.driveDate) : null} 
              onChange={(date: Date | null) => setForm({ ...form, driveDate: date ? date.toISOString().split("T")[0] : "" })} 
            />
          </div>
          <div className="field">
            <label>Application Deadline *</label>
            <DatePicker 
              value={form.applicationDeadline ? new Date(form.applicationDeadline) : null} 
              onChange={(date: Date | null) => setForm({ ...form, applicationDeadline: date ? date.toISOString().split("T")[0] : "" })} 
            />
          </div>
        </div>

        <div className="field">
          <label>Application Method *</label>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="radio" checked={form.applyMethod === "IN_APP"} onChange={() => setForm({ ...form, applyMethod: "IN_APP" })} />
              <span>In-App</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="radio" checked={form.applyMethod === "EXTERNAL"} onChange={() => setForm({ ...form, applyMethod: "EXTERNAL" })} />
              <span>External Link</span>
            </label>
          </div>
        </div>

        {form.applyMethod === "EXTERNAL" && (
          <div className="field">
            <label>External Application URL *</label>
            <UrlField
              value={(form.externalApplyUrl || "").replace(/^https?:\/\//i, "")}
              onChange={(val: string) => setForm({ ...form, externalApplyUrl: val ? (val.startsWith("http") ? val : `https://${val}`) : "" })}
            />
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Selection Rounds</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={roundInput}
            onChange={(e) => setRoundInput(e.target.value)}
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRound(); } }}
          />
          <button type="button" onClick={handleAddRound} className="btn btn-primary btn-sm">Add</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {form.selectionRounds.map((round: string, idx: number) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface-1)", borderRadius: 6 }}>
              <span>{idx + 1}. {round}</span>
              <button type="button" onClick={() => handleRemoveRound(idx)} className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <AdminDriveLogisticsPanel venue={form.venue} reportingTime={form.reportingTime} contactPerson={form.contactPerson} contactPhone={form.contactPhone} pptLink={form.pptLink} onChange={handleLogisticsChange} />
      
      <AdminApplicationFieldsPanel fields={applicationFields} onChange={setApplicationFields} />
      
      <AdminDrivePreviewCard
        drive={{
          companyName: form.companyName,
          roleName: form.roleName,
          packageOffered: parseFloat(form.packageOffered),
          packageDisplay: form.packageDisplay,
          minCGPA: parseFloat(form.minCGPA),
          driveDate: new Date(form.driveDate),
          applicationDeadline: new Date(form.applicationDeadline),
        }}
        venue={form.venue}
        reportingTime={form.reportingTime}
        deptCode={departmentCode}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button type="button" onClick={() => router.back()} className="btn btn-outline" disabled={isPending}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
