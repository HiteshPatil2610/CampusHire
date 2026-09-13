"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDrive } from "@/features/drives/actions/create-drive";
import { AdminDriveLogisticsPanel } from "@/components/admin/drives/admin-drive-logistics-panel";
import {
  AdminApplicationFieldsPanel,
  type ApplicationFieldConfig,
} from "@/components/admin/drives/admin-application-fields-panel";
import { AdminDrivePreviewCard } from "@/components/admin/drives/admin-drive-preview-card";
import DatePicker from "@/components/ui/date-picker";
import UrlField from "@/components/ui/url-field";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  code: string;
}

interface PostDriveFormProps {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  allDepartments: Department[];
}

export function PostDriveForm({
  departmentId,
  departmentName,
  departmentCode,
  allDepartments,
}: PostDriveFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    companyName: "",
    roleName: "",
    packageOffered: "",
    packageDisplay: "",
    jobDescriptionUrl: "",
    minCGPA: "7.0",
    maxActiveBacklogs: "0",
    eligibleDepartments: [departmentId],
    driveDate: "",
    applicationDeadline: "",
    applyMethod: "IN_APP" as "IN_APP" | "EXTERNAL",
    externalApplyUrl: "",
    selectionRounds: ["Aptitude Test", "Technical Interview", "HR Interview"],
    venue: "",
    reportingTime: "",
    contactPerson: "",
    contactPhone: "",
    pptLink: "",
  });

  const [applicationFields, setApplicationFields] = useState<ApplicationFieldConfig[]>([
    {
      key: "name",
      label: "Full Name",
      source: "profile",
      category: "Basic Identity",
      icon: "👤",
      required: true,
      enabled: true,
    },
    {
      key: "rollNo",
      label: "Roll Number",
      source: "profile",
      category: "Basic Identity",
      icon: "🪪",
      required: true,
      enabled: true,
    },
    {
      key: "email",
      label: "College Email",
      source: "profile",
      category: "Contact Info",
      icon: "✉️",
      required: true,
      enabled: true,
    },
    {
      key: "phone",
      label: "Mobile Number",
      source: "profile",
      category: "Contact Info",
      icon: "📞",
      required: true,
      enabled: true,
    },
    {
      key: "cgpa",
      label: "Current CGPA",
      source: "profile",
      category: "Academic Records",
      icon: "🎓",
      required: true,
      enabled: true,
    },
    {
      key: "backlogs",
      label: "Active Backlogs",
      source: "profile",
      category: "Academic Records",
      icon: "⚠️",
      required: true,
      enabled: true,
    },
    {
      key: "department",
      label: "Department",
      source: "profile",
      category: "Academic Records",
      icon: "🏛️",
      required: true,
      enabled: true,
    },
  ]);

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
      selectionRounds: prev.selectionRounds.filter((_, i) => i !== index),
    }));
  }

  function handleDeptToggle(deptId: string) {
    setForm((prev) => {
      const current = prev.eligibleDepartments;
      if (deptId === departmentId) return prev; // Can't uncheck own dept
      
      if (current.includes(deptId)) {
        return { ...prev, eligibleDepartments: current.filter((id) => id !== deptId) };
      } else {
        return { ...prev, eligibleDepartments: [...current, deptId] };
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
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

    if (!form.driveDate || !form.applicationDeadline) {
      toast({
        title: "Error",
        description: "Drive date and deadline are required",
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
        description: "External apply URL is required for external application method",
        variant: "destructive",
      });
      return;
    }

    if (form.selectionRounds.length === 0) {
      toast({
        title: "Error",
        description: "At least one selection round is required",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await createDrive({
        companyName: form.companyName.trim(),
        roleName: form.roleName.trim(),
        packageOffered: packageNum,
        packageDisplay: form.packageDisplay.trim() || undefined,
        jobDescriptionUrl: form.jobDescriptionUrl.trim() || undefined,
        minCGPA: parseFloat(form.minCGPA),
        maxActiveBacklogs: parseInt(form.maxActiveBacklogs, 10),
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
          title: "Drive posted!",
          description: "Drive posted successfully. Students will see it in their eligible drives list.",
        });
        router.push("/admin-dashboard/drives");
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to post drive",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Section 1: Company & Role Details */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Company & Role Details</h3>
        
        <div className="field-row">
          <div className="field">
            <label>Company Name *</label>
            <input
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="e.g. Google, Microsoft, Amazon"
            />
          </div>
          <div className="field">
            <label>Role / Job Title *</label>
            <input
              required
              value={form.roleName}
              onChange={(e) => setForm({ ...form, roleName: e.target.value })}
              placeholder="e.g. Software Engineer, Data Analyst"
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
              min="0"
              max="1000"
              value={form.packageOffered}
              onChange={(e) => setForm({ ...form, packageOffered: e.target.value })}
              placeholder="e.g. 12.5"
            />
          </div>
          <div className="field">
            <label>Package Display (optional)</label>
            <input
              value={form.packageDisplay}
              onChange={(e) => setForm({ ...form, packageDisplay: e.target.value })}
              placeholder="e.g. 12-16 LPA or 12.5 LPA + 2 LPA joining bonus"
            />
          </div>
        </div>

        <div className="field">
          <label>Job Description URL (optional)</label>
          <UrlField
            placeholder="careers.company.com/job-12345"
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

      {/* Section 2: Eligibility Criteria */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Eligibility Criteria</h3>

        <div className="field-row">
          <div className="field">
            <label>Minimum CGPA *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={form.minCGPA}
              onChange={(e) => setForm({ ...form, minCGPA: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Max Active Backlogs *</label>
            <input
              required
              type="number"
              min="0"
              max="10"
              value={form.maxActiveBacklogs}
              onChange={(e) => setForm({ ...form, maxActiveBacklogs: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label>Eligible Departments *</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginTop: 8 }}>
            {allDepartments.map((dept) => {
              const isOwnDept = dept.id === departmentId;
              const isChecked = form.eligibleDepartments.includes(dept.id);
              
              return (
                <label
                  key={dept.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: isChecked ? "var(--accent-light)" : "var(--surface-1)",
                    border: "0.5px solid var(--border)",
                    borderRadius: 6,
                    cursor: isOwnDept ? "not-allowed" : "pointer",
                    opacity: isOwnDept ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleDeptToggle(dept.id)}
                    disabled={isOwnDept}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {dept.code} - {dept.name}
                    {isOwnDept && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>(your dept)</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 3: Dates & Application Method */}
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
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                checked={form.applyMethod === "IN_APP"}
                onChange={() => setForm({ ...form, applyMethod: "IN_APP" })}
              />
              <span>In-App (Students apply through CampusHire)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                checked={form.applyMethod === "EXTERNAL"}
                onChange={() => setForm({ ...form, applyMethod: "EXTERNAL" })}
              />
              <span>External Link</span>
            </label>
          </div>
        </div>

        {form.applyMethod === "EXTERNAL" && (
          <div className="field">
            <label>External Application URL *</label>
            <UrlField
              placeholder="apply.company.com/careers"
              value={(form.externalApplyUrl || "").replace(/^https?:\/\//i, "")}
              onChange={(val: string) =>
                setForm({
                  ...form,
                  externalApplyUrl: val ? (val.startsWith("http") ? val : `https://${val}`) : "",
                })
              }
            />
          </div>
        )}
      </div>

      {/* Section 4: Selection Rounds */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Selection Rounds</h3>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          Define the interview/assessment stages for this drive
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={roundInput}
            onChange={(e) => setRoundInput(e.target.value)}
            placeholder="e.g. Group Discussion"
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddRound();
              }
            }}
          />
          <button type="button" onClick={handleAddRound} className="btn btn-primary btn-sm">
            Add Round
          </button>
        </div>

        {form.selectionRounds.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {form.selectionRounds.map((round, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "var(--surface-1)",
                  border: "0.5px solid var(--border)",
                  borderRadius: 6,
                }}
              >
                <span style={{ fontSize: 13 }}>
                  {index + 1}. {round}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveRound(index)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--red)", padding: "2px 6px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 5: Logistics */}
      <AdminDriveLogisticsPanel
        venue={form.venue}
        reportingTime={form.reportingTime}
        contactPerson={form.contactPerson}
        contactPhone={form.contactPhone}
        pptLink={form.pptLink}
        onChange={handleLogisticsChange}
      />

      {/* Section 6: Application Fields */}
      <AdminApplicationFieldsPanel
        fields={applicationFields}
        onChange={setApplicationFields}
      />

      {/* Section 7: Preview */}
      <AdminDrivePreviewCard
        drive={{
          companyName: form.companyName || "Company Name",
          roleName: form.roleName || "Role Name",
          packageOffered: parseFloat(form.packageOffered) || 0,
          packageDisplay: form.packageDisplay,
          minCGPA: parseFloat(form.minCGPA),
          driveDate: form.driveDate ? new Date(form.driveDate) : new Date(),
          applicationDeadline: form.applicationDeadline ? new Date(form.applicationDeadline) : new Date(),
        }}
        venue={form.venue}
        reportingTime={form.reportingTime}
        deptCode={departmentCode}
      />

      {/* Submit Button */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-outline"
          disabled={isPending}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending ? "Posting Drive..." : "Post Drive"}
        </button>
      </div>
    </form>
  );
}
