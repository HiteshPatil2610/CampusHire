'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StudentAcademicPanel } from './student-academic-panel';

/**
 * Mark a student as Drop straight from the roster: the student's academic
 * standing with Mark as Drop, the drop history and Undo (within 48 hours) —
 * the same panel the student's details dialog shows. Department admins only;
 * the server decides every drop.
 */
export function StudentDropDialog({
  student,
  onClose,
}: {
  student: { id: string; name: string; rollNumber: string | null } | null;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle>
            Drop — {student?.name}
            <span className="text-muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
              {student?.rollNumber}
            </span>
          </DialogTitle>
        </DialogHeader>
        {student && (
          <StudentAcademicPanel
            studentId={student.id}
            // The roster shows the year and batch a drop changes.
            onChanged={() => router.refresh()}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
