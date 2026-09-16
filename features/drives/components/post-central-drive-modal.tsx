"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DatePicker from "@/components/ui/date-picker";
import UrlField from "@/components/ui/url-field";
import CompanyLogoField from "@/components/shared/company-logo-field";
import { createCentralDrive } from "../actions/create-central-drive";

interface PostCentralDriveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every active department — a central drive is institution-wide by default. */
  eligibleDepartmentIds: string[];
  onCreated: (driveId: string) => void;
}

const EMPTY_FORM = {
  companyName: "",
  companyLogoUrl: null as string | null,
  roleName: "",
  packageDisplay: "",
  minCGPA: "",
  driveDate: null as Date | null,
  applicationDeadline: null as Date | null,
  externalApplyUrl: "",
  pptLink: "",
  jobDescriptionText: "",
};

export function PostCentralDriveModal({
  open,
  onOpenChange,
  eligibleDepartmentIds,
  onCreated,
}: PostCentralDriveModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY_FORM);

  function setField<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!form.driveDate || !form.applicationDeadline) {
      toast({
        title: "Error",
        description: "Drive date and application deadline are required",
        variant: "destructive",
      });
      return;
    }

    const minCGPA = Number.parseFloat(form.minCGPA);
    if (Number.isNaN(minCGPA)) {
      toast({
        title: "Error",
        description: "Enter a valid minimum CGPA cutoff",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      const result = await createCentralDrive({
        companyName: form.companyName.trim(),
        companyLogoUrl: form.companyLogoUrl,
        roleName: form.roleName.trim(),
        packageDisplay: form.packageDisplay.trim(),
        minCGPA,
        maxActiveBacklogs: 0,
        driveDate: form.driveDate!.toISOString(),
        applicationDeadline: form.applicationDeadline!.toISOString(),
        externalApplyUrl: form.externalApplyUrl.trim(),
        pptLink: form.pptLink.trim(),
        jobDescriptionText: form.jobDescriptionText.trim(),
        eligibleDepartments: eligibleDepartmentIds,
      });

      if (result.success && result.driveId) {
        toast({
          title: "Central drive created",
          description: `${form.companyName.trim()} is now live across all active departments.`,
        });
        setForm(EMPTY_FORM);
        onOpenChange(false);
        onCreated(result.driveId);
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent style={{ maxWidth: 640 }}>
        <DialogHeader>
          <DialogTitle>Post Central Drive</DialogTitle>
        </DialogHeader>

        <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 4 }}>
          <div className="field">
            <label htmlFor="cd-company">Company Name *</label>
            <input
              id="cd-company"
              type="text"
              value={form.companyName}
              onChange={(e) => setField("companyName", e.target.value)}
              placeholder="e.g. Infosys"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="cd-role">Role / Designation *</label>
            <input
              id="cd-role"
              type="text"
              value={form.roleName}
              onChange={(e) => setField("roleName", e.target.value)}
              placeholder="e.g. Systems Engineer"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="cd-package">Package / CTC *</label>
            <input
              id="cd-package"
              type="text"
              value={form.packageDisplay}
              onChange={(e) => setField("packageDisplay", e.target.value)}
              placeholder="e.g. 14 – 22 LPA"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="cd-cgpa">Min CGPA Cutoff *</label>
            <input
              id="cd-cgpa"
              type="number"
              min={0}
              max={10}
              step={0.01}
              value={form.minCGPA}
              onChange={(e) => setField("minCGPA", e.target.value)}
              placeholder="e.g. 7.00"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label>Drive Date *</label>
            <DatePicker
              value={form.driveDate}
              onChange={(date) => setField("driveDate", date)}
              placeholder="Select drive date"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label>Application Deadline *</label>
            <DatePicker
              value={form.applicationDeadline}
              onChange={(date) => setField("applicationDeadline", date)}
              placeholder="Select application deadline"
              disabled={isPending}
            />
          </div>

          <CompanyLogoField
            value={form.companyLogoUrl}
            onChange={(companyLogoUrl) =>
              setField("companyLogoUrl", companyLogoUrl)
            }
            disabled={isPending}
          />

          <div className="field">
            <label>Company Portal / Registration URL (Optional)</label>
            <UrlField
              value={form.externalApplyUrl}
              onChange={(value) => setField("externalApplyUrl", value)}
              platform="url"
              placeholder="careers.company.com/apply"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label>Pre-Placement Talk (PPT) Link (Optional)</label>
            <UrlField
              value={form.pptLink}
              onChange={(value) => setField("pptLink", value)}
              platform="url"
              placeholder="meet.google.com/xyz-abcd"
              disabled={isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="cd-jd">Job Description &amp; Instructions</label>
            <textarea
              id="cd-jd"
              rows={5}
              value={form.jobDescriptionText}
              onChange={(e) => setField("jobDescriptionText", e.target.value)}
              placeholder="Role responsibilities, selection process, documents to carry…"
              disabled={isPending}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? "Creating…" : "Create Central Drive"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
