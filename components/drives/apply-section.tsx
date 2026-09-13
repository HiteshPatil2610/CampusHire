'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { applyToDrive } from '@/features/applications/actions/apply-to-drive';
import { formatDriveDate, formatDeadline } from '@/lib/drive-date-helpers';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ApplySectionProps {
  driveId: string;
  companyName: string;
  roleName: string;
  driveDate: Date;
  applicationDeadline: Date;
  driveStatus: 'open' | 'closed';
  hasApplied: boolean;
  applyMethod: 'IN_APP' | 'EXTERNAL';
  externalApplyUrl?: string | null;
  studentName: string;
  studentCGPA: number;
  studentBacklogs: number;
  studentDepartment: string;
  studentRollNumber: string;
}

/**
 * Apply Section - handles apply button and confirmation dialog
 * 
 * State machine:
 * - idle: Show appropriate button based on status
 * - confirm: Dialog open, waiting for user confirmation
 * - submitting: Calling applyToDrive server action
 * - applied: Application submitted successfully
 */
export function ApplySection({
  driveId,
  companyName,
  roleName,
  driveDate,
  applicationDeadline,
  driveStatus,
  hasApplied,
  applyMethod,
  externalApplyUrl,
  studentName,
  studentCGPA,
  studentBacklogs,
  studentDepartment,
  studentRollNumber,
}: ApplySectionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function handleApplyClick() {
    if (applyMethod === 'EXTERNAL' && externalApplyUrl) {
      // Open external URL
      window.open(externalApplyUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    // Open confirmation dialog for in-app application
    setIsDialogOpen(true);
  }

  function handleConfirmApply() {
    startTransition(async () => {
      try {
        const result = await applyToDrive(driveId);

        if (result.success) {
          toast({
            title: 'Application Submitted',
            description: `Your application to ${roleName} at ${companyName} has been submitted successfully.`,
            variant: 'default',
          });
          setIsDialogOpen(false);
          // Refresh the page to update UI
          router.refresh();
        } else {
          toast({
            title: 'Application Failed',
            description: result.error,
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        });
      }
    });
  }

  // Already applied
  if (hasApplied) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--success-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
          }}
        >
          ✓
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--success)',
              marginBottom: 2,
            }}
          >
            Application Submitted
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            You have successfully applied to this drive
          </div>
        </div>
      </div>
    );
  }

  // Drive closed
  if (driveStatus === 'closed') {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 4,
          }}
        >
          Applications Closed
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          The application deadline for this drive has passed
        </div>
      </div>
    );
  }

  // External apply method
  if (applyMethod === 'EXTERNAL' && externalApplyUrl) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 12,
          }}
        >
          This drive requires you to apply through the company&apos;s external portal
        </div>
        <button
          type="button"
          onClick={handleApplyClick}
          style={{
            width: '100%',
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          Apply on Company Website ↗
        </button>
      </div>
    );
  }

  // In-app apply - show apply button
  return (
    <>
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
        }}
      >
        <button
          type="button"
          onClick={handleApplyClick}
          disabled={isPending}
          style={{
            width: '100%',
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: isPending ? 'var(--surface-2)' : 'var(--accent)',
            color: 'white',
            cursor: isPending ? 'not-allowed' : 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Submitting...' : 'Apply Now'}
        </button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent style={{ maxWidth: 480 }}>
          <DialogHeader>
            <DialogTitle>Confirm Application</DialogTitle>
            <DialogDescription>
              Please review your application details before submitting
            </DialogDescription>
          </DialogHeader>

          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              fontSize: 13,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Applying to:
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {roleName} at {companyName}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Drive Details:
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Drive date: {formatDriveDate(driveDate)}
                <br />
                Deadline: {formatDeadline(applicationDeadline)}
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                marginTop: 12,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Your application will include:
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                <li>Name: {studentName}</li>
                <li>Roll Number: {studentRollNumber}</li>
                <li>Department: {studentDepartment}</li>
                <li>CGPA: {studentCGPA}</li>
                <li>Active Backlogs: {studentBacklogs}</li>
              </ul>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 6,
              background: 'var(--amber-surface)',
              border: '1px solid var(--amber)',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            ⚠️ <strong>Important:</strong> Applications are final — you cannot withdraw or edit
            after submitting.
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              disabled={isPending}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface-0)',
                color: 'var(--text-primary)',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmApply}
              disabled={isPending}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                background: isPending ? 'var(--surface-2)' : 'var(--accent)',
                color: 'white',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Submitting...' : 'Confirm & Submit'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
