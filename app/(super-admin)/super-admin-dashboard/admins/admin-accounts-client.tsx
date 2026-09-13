"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { createAdminAccount } from "@/features/admin-accounts/actions/create-admin-account";
import { assignDepartmentAdmin } from "@/features/admin-accounts/actions/assign-department-admin";
import { removeDepartmentAdmin } from "@/features/admin-accounts/actions/remove-department-admin";
import { getAvailableUsers } from "@/features/admin-accounts/queries/get-available-users";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Pagination from "@/components/ui/pagination";
import type { Department } from "@prisma/client";

interface Admin {
  id: string;
  user: {
    id: string;
    email: string;
    clerkId: string;
    role: string;
    createdAt: Date;
  };
  department: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  };
  createdAt: Date;
}

interface Props {
  admins: Admin[];
  page: number;
  pageSize: number;
  totalCount: number;
  departments: Department[];
  selectedDepartmentId?: string;
}

export function AdminAccountsClient({
  admins,
  page,
  pageSize,
  totalCount,
  departments,
  selectedDepartmentId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Create admin dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createDeptId, setCreateDeptId] = useState("");

  // Assign existing user dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignDeptId, setAssignDeptId] = useState("");
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Department filter
  function handleDeptFilter(deptId: string) {
    const url = new URL(window.location.href);
    if (deptId) {
      url.searchParams.set('departmentId', deptId);
    } else {
      url.searchParams.delete('departmentId');
    }
    url.searchParams.delete('page');
    router.push(url.pathname + url.search);
  }

  // Create new admin account
  async function handleCreateAdmin() {
    if (!createName.trim() || !createEmail.trim() || !createDeptId) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await createAdminAccount({
        name: createName.trim(),
        email: createEmail.trim(),
        departmentId: createDeptId,
      });

      if (result.success) {
        toast({
          title: "Success",
          description: `Admin account created. They can log in with ${result.email} using 'Forgot Password' to set their password.`,
        });
        setCreateOpen(false);
        setCreateName("");
        setCreateEmail("");
        setCreateDeptId("");
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  // Search for available users
  async function handleSearchUsers() {
    if (!assignSearch.trim()) {
      setAvailableUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await getAvailableUsers({
        search: assignSearch.trim(),
        limit: 10,
      });

      setAvailableUsers(result);
    } catch (error) {
      toast({ title: "Error", description: "Failed to search users", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }

  // Assign existing user as admin
  async function handleAssignUser() {
    if (!selectedUserId || !assignDeptId) {
      toast({ title: "Error", description: "Please select a user and department", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const result = await assignDepartmentAdmin({
        userId: selectedUserId,
        departmentId: assignDeptId,
      });

      if (result.success) {
        toast({ title: "Success", description: "User assigned as department admin" });
        setAssignOpen(false);
        setAssignSearch("");
        setAssignDeptId("");
        setAvailableUsers([]);
        setSelectedUserId("");
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  // Remove admin
  async function handleRemoveAdmin(admin: Admin) {
    startTransition(async () => {
      const result = await removeDepartmentAdmin({
        userId: admin.user.id,
      });

      if (result.success) {
        toast({ title: "Success", description: "Admin access revoked" });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <>
      {/* Header Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <button className="btn btn-primary">+ Create Admin Account</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Admin Account</DialogTitle>
            </DialogHeader>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Full name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="admin@college.edu"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Department</label>
                <select
                  className="input"
                  value={createDeptId}
                  onChange={(e) => setCreateDeptId(e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
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
                  onClick={handleCreateAdmin}
                  disabled={isPending}
                >
                  {isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogTrigger asChild>
            <button className="btn btn-outline">Assign Existing User</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Existing User as Admin</DialogTitle>
            </DialogHeader>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="form-label">Search User</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by email..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleSearchUsers}
                    disabled={isSearching}
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {availableUsers.length > 0 && (
                <div>
                  <label className="form-label">Select User</label>
                  <div
                    style={{
                      border: '0.5px solid var(--border-strong)',
                      borderRadius: 8,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        style={{
                          padding: 12,
                          cursor: 'pointer',
                          background: selectedUserId === user.id ? 'var(--teal-light)' : 'transparent',
                          borderBottom: '0.5px solid var(--border-strong)',
                        }}
                      >
                        {user.email}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="form-label">Department</label>
                <select
                  className="input"
                  value={assignDeptId}
                  onChange={(e) => setAssignDeptId(e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setAssignOpen(false);
                    setAssignSearch("");
                    setAvailableUsers([]);
                    setSelectedUserId("");
                  }}
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAssignUser}
                  disabled={isPending || !selectedUserId}
                >
                  {isPending ? 'Assigning...' : 'Assign as Admin'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Department Filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: 13 }}>Filter:</span>
          <select
            className="input"
            value={selectedDepartmentId || ''}
            onChange={(e) => handleDeptFilter(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Admin Accounts Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Department</th>
              <th>Assigned</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="text-muted">No admin accounts found</div>
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.user.email}</td>
                  <td>
                    {admin.department.name}
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {admin.department.code}
                    </div>
                  </td>
                  <td>
                    {new Date(admin.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td>
                    <AlertDialog>
                      <AlertDialogTrigger>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={isPending}
                        >
                          Remove
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Admin Access?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will revoke {admin.user.email}&apos;s admin access. They will no
                            longer be able to manage the {admin.department.name} department.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveAdmin(admin)}>
                            Remove Admin
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
    </>
  );
}
