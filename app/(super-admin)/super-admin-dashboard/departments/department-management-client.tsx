"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { createDepartment } from "@/features/departments/actions/create-department";
import { updateDepartment } from "@/features/departments/actions/update-department";
import { toggleDepartmentStatus } from "@/features/departments/actions/toggle-department-status";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import StatusBadge from "@/components/ui/status-badge";
import Pagination from "@/components/ui/pagination";
import type { Department } from "@prisma/client";

interface DepartmentWithCounts extends Department {
  adminCount: number;
  studentCount: number;
  driveCount: number;
}

interface Props {
  departments: DepartmentWithCounts[];
  page: number;
  pageSize: number;
  totalCount: number;
  includeInactive: boolean;
}

export function DepartmentManagementClient({ departments, page, pageSize, totalCount, includeInactive }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  
  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editDept, setEditDept] = useState<DepartmentWithCounts | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  function handleToggleInactive() {
    const url = new URL(window.location.href);
    if (includeInactive) {
      url.searchParams.delete('includeInactive');
    } else {
      url.searchParams.set('includeInactive', 'true');
    }
    url.searchParams.delete('page'); // Reset to page 1
    router.push(url.pathname + url.search);
  }

  async function handleCreate() {
    if (!createName.trim() || !createCode.trim()) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await createDepartment({
        name: createName.trim(),
        code: createCode.trim().toUpperCase(),
        isActive: true,
      });

      if (result.success) {
        toast({ title: "Success", description: `${result.data.name} department created` });
        setCreateOpen(false);
        setCreateName("");
        setCreateCode("");
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function openEditDialog(dept: DepartmentWithCounts) {
    setEditDept(dept);
    setEditName(dept.name);
    setEditCode(dept.code);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editDept || !editName.trim() || !editCode.trim()) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await updateDepartment({
        id: editDept.id,
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
      });

      if (result.success) {
        toast({ title: "Success", description: "Department updated" });
        setEditOpen(false);
        setEditDept(null);
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  async function handleToggleStatus(dept: DepartmentWithCounts) {
    startTransition(async () => {
      const result = await toggleDepartmentStatus({
        id: dept.id,
        isActive: !dept.isActive,
      });

      if (result.success) {
        const action = result.data.isActive ? "activated" : "deactivated";
        toast({ title: "Success", description: `Department ${action}` });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <>
      {/* Header Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <button className="btn btn-primary">+ Add Department</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Department</DialogTitle>
            </DialogHeader>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Department Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Computer Science"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Department Code</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., CSE"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  style={{ fontFamily: 'monospace' }}
                  maxLength={10}
                />
                <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                  2-10 uppercase letters/numbers only
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={isPending}
                >
                  {isPending ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <button
          type="button"
          className={includeInactive ? "btn btn-primary" : "btn btn-outline"}
          onClick={handleToggleInactive}
        >
          {includeInactive ? '✓ ' : ''}Show Inactive
        </button>
      </div>

      {/* Departments Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Students</th>
              <th>Admins</th>
              <th>Drives</th>
              <th>Status</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="text-muted">No departments found</div>
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    <Link href={`/super-admin-dashboard/departments/${dept.id}`}>
                      <strong>{dept.name}</strong>
                    </Link>
                  </td>
                  <td>
                    <code style={{ fontSize: 12 }}>{dept.code}</code>
                  </td>
                  <td>{dept.studentCount}</td>
                  <td>{dept.adminCount}</td>
                  <td>{dept.driveCount}</td>
                  <td>
                    {dept.isActive ? (
                      <StatusBadge variant="teal">Active</StatusBadge>
                    ) : (
                      <StatusBadge variant="red">Inactive</StatusBadge>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEditDialog(dept)}
                      >
                        Edit
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={isPending}
                          >
                            {dept.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {dept.isActive ? 'Deactivate' : 'Activate'} Department?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {dept.isActive ? (
                                <>
                                  Deactivating this department will prevent its admins from accessing
                                  their dashboard until it is reactivated. Students and drives will
                                  remain in the system.
                                </>
                              ) : (
                                <>Reactivate {dept.name} department?</>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleToggleStatus(dept)}>
                              {dept.isActive ? 'Deactivate' : 'Activate'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ marginTop: 20 }}>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={(newPage) => {
            const url = new URL(window.location.href);
            url.searchParams.set('page', newPage.toString());
            router.push(url.pathname + url.search);
          }}
        />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="form-label">Department Name</label>
              <input
                type="text"
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Department Code</label>
              <input
                type="text"
                className="input"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                style={{ fontFamily: 'monospace' }}
                maxLength={10}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditOpen(false)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEdit}
                disabled={isPending}
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
