# Frontend Quick Reference - What Needs to be Built

## 🎯 Quick Summary

**Backend Complete:** Units 01-10 ✅  
**Frontend Status:** ~20% complete (auth, basic dashboards, notifications page)  
**Remaining Work:** ~80 components across 12 main pages

---

## 📋 Pages to Build (12 Total)

### Student Pages (5) - **HIGHEST PRIORITY**

1. **Student Profile** → `/student-dashboard/profile`
   - Edit all 7 sections (personal, academic, skills, projects, experience, certifications, preferences)
   - Upload profile photo
   - View completion percentage

2. **Available Drives** → `/student-dashboard/drives`
   - Browse drives student is eligible for
   - Filter and search
   - See deadline countdown

3. **Drive Detail** → `/student-dashboard/drives/[id]`
   - View full job description
   - Check eligibility criteria
   - Apply to drive with one click

4. **My Applications** → `/student-dashboard/applications`
   - View all submitted applications
   - See application status
   - Filter by status

### Department Admin Pages (3) - **MEDIUM PRIORITY**

5. **Drive Management** → `/admin-dashboard/drives`
   - List all department drives
   - Create/edit/deactivate drives
   - View application counts

6. **Create/Edit Drive** → `/admin-dashboard/drives/new` or `/[id]/edit`
   - Form to create drive
   - Set eligibility criteria (CGPA, backlogs, departments)
   - Set deadline, package, location
   - Upload JD PDF

7. **Drive Applications** → `/admin-dashboard/drives/[id]/applications`
   - View all applicants for a drive
   - See student details
   - Export to Excel

### Super Admin Pages (3) - **LOWER PRIORITY**

8. **Departments Management** → `/super-admin-dashboard/departments`
   - Create/edit departments
   - Activate/deactivate
   - View statistics

9. **Admin Accounts** → `/super-admin-dashboard/admins`
   - Assign department admins
   - Remove admin assignments
   - View all admins

10. **Enhanced Audit Logs** → `/super-admin-dashboard/audit-logs`
    - Add filters (action, entity, user, date)
    - Add metadata viewer
    - Export to CSV

### Optional Pages (2) - **FUTURE**

11. **Bulk Import** → `/admin-dashboard/bulk-import`
    - Upload Excel/CSV
    - Validate and preview
    - Import students
    - *Requires Unit 07 backend implementation*

12. **Notification Integration**
    - Add NotificationBell to header
    - Add deep linking
    - Add real-time updates

---

## 🧩 Key Components by Feature

### Student Profile (10 components)
```
ProfileHeader, PersonalInfoSection, AcademicInfoSection,
SkillsSection, ProjectsSection, ExperienceSection,
CertificationsSection, PreferencesSection, PhotoUpload,
ProgressBar
```

### Drives (8 components)
```
DriveCard, DriveFilters, DriveSearch, DriveDetailHeader,
EligibilityChecklist, ApplicationButton, DeadlineCountdown,
CompanyInfo
```

### Applications (4 components)
```
ApplicationCard, ApplicationsTable, ApplicationStatus,
ApplicationTimeline
```

### Admin - Drives (6 components)
```
DriveTable, CreateDriveButton, DriveForm, EligibilityFields,
JDUpload, ExportButton
```

### Admin - Departments (6 components)
```
DepartmentTable, CreateDepartmentDialog, EditDepartmentDialog,
DepartmentStats, StatusBadge, DepartmentActions
```

### Admin - Accounts (4 components)
```
AdminTable, AssignAdminDialog, RemoveAdminDialog,
UserSelector
```

### Audit Logs (5 components)
```
AuditLogTable, AuditFilters, ActionBadge, MetadataViewer,
DateRangePicker
```

### Shared/Common (15+ components)
```
Header, Sidebar, Footer, DataTable, FileUpload,
StatCard, EmptyState, LoadingSkeleton, ConfirmationDialog,
FormField, FormError, SubmitButton, StatusBadge,
SearchBar, Pagination
```

**Total: ~80-100 components**

---

## 🔌 Backend APIs Ready to Use

### Student APIs ✅
```typescript
// Profile
features/students/queries/get-profile.ts
features/students/queries/profile-completion.ts
features/students/actions/profile-*.ts (8 actions)

// Applications
features/applications/queries/get-my-applications.ts
features/applications/actions/apply-to-drive.ts
```

### Drive APIs ✅
```typescript
// Eligibility
features/drives/queries/is-student-eligible.ts
features/drives/queries/get-drive-status.ts
```

### Department APIs ✅
```typescript
// CRUD
features/departments/queries/get-departments.ts
features/departments/queries/get-department-detail.ts
features/departments/actions/create-department.ts
features/departments/actions/update-department.ts
features/departments/actions/toggle-department-status.ts
```

### Admin Accounts APIs ✅
```typescript
features/admin-accounts/queries/get-department-admins.ts
features/admin-accounts/queries/get-available-users.ts
features/admin-accounts/actions/assign-department-admin.ts
features/admin-accounts/actions/remove-department-admin.ts
```

### Audit Logs APIs ✅
```typescript
features/audit/queries/get-audit-logs.ts
```

### Notifications APIs ✅
```typescript
features/notifications/queries/get-notifications.ts
features/notifications/queries/get-unread-count.ts
features/notifications/actions/mark-notification-read.ts
features/notifications/actions/mark-all-notifications-read.ts
```

---

## 🚀 Recommended Build Order

### Week 1-2: Student Core Experience
1. Build shared components (Header, Sidebar, DataTable)
2. Student Profile page with all sections
3. Available Drives page (list view)
4. Drive Detail page with Apply button
5. My Applications page

**Outcome:** Students can complete profiles and apply to drives

### Week 3: Admin Drive Management
6. Drive Management dashboard
7. Create/Edit Drive form
8. Drive Applications page (view applicants)

**Outcome:** Admins can post drives and view applications

### Week 4: Super Admin Features
9. Departments Management page
10. Admin Accounts page
11. Enhanced Audit Logs with filters

**Outcome:** Super admin can manage departments and admins

### Future: Optional Features
12. Bulk Import page (requires backend implementation)
13. Real-time notifications
14. Export features
15. Analytics dashboards

---

## 💡 Quick Start Guide

### Step 1: Set Up Shared Components
Create these first as they'll be reused everywhere:
- `components/layout/Header.tsx` (with NotificationBell)
- `components/layout/Sidebar.tsx` (role-based navigation)
- `components/ui/data-table.tsx` (reusable table)
- `components/ui/stat-card.tsx` (statistics cards)
- `components/ui/empty-state.tsx` (no data placeholder)

### Step 2: Build First Student Page
Start with **Student Profile** page:
- Create `app/(student)/student-dashboard/profile/page.tsx`
- Build section components one at a time
- Use existing server actions (already tested)
- Match NotificationList component style

### Step 3: Test and Iterate
- Test each section as you build it
- Verify data flows correctly
- Check validation feedback
- Test error handling

### Step 4: Continue with Priority Order
Follow the recommended build order above

---

## 📦 Dependencies Already Installed

✅ Existing:
- Next.js 15 (App Router)
- React 19
- TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui
- Zod (validation)
- Prisma (database)
- Clerk (auth)

⏳ May Need:
- React Hook Form (form management)
- date-fns or dayjs (date formatting)
- React Query or SWR (optional, for client-side data fetching)
- react-dropzone (file uploads)
- recharts (for analytics dashboards - future)

---

## 🎨 Styling Guidelines

Use existing design tokens from `app/globals.css`:
```css
--primary: #2563EB (blue)
--secondary: #1E293B (dark gray)
--success: #10B981 (green)
--warning: #F59E0B (yellow)
--error: #EF4444 (red)
--text-primary: #1E293B
--text-secondary: #64748B
```

Match existing component styles:
- See `components/notifications/NotificationList.tsx` for patterns
- Use Tailwind utility classes
- Maintain spacing consistency (p-4, p-6, p-8)
- Follow responsive design (mobile-first)

---

## 📊 Effort Estimate

**Total Time:** 80-120 hours

**Breakdown:**
- Shared components: 15-20 hours
- Student pages (5): 30-40 hours
- Admin pages (3): 25-35 hours
- Super admin pages (3): 15-20 hours
- Optional features: 10-25 hours

**Per Page Average:** 6-10 hours
- Simple page (list): 4-6 hours
- Complex page (form): 8-12 hours
- Table with filters: 6-8 hours

---

## ✅ What's Already Done

1. ✅ Authentication flow (Clerk)
2. ✅ Role-based routing (middleware)
3. ✅ Student registration form
4. ✅ Basic dashboards (landing pages)
5. ✅ Notifications page (complete)
6. ✅ NotificationList component
7. ✅ NotificationBell component (ready to integrate)
8. ✅ All backend APIs (tested and working)
9. ✅ Database schema (complete)
10. ✅ Server actions (all units complete)

You have a **solid foundation** and all the APIs ready. The frontend work is primarily UI development and integration!

---

## 🎯 Start Here

**Recommended first task:**

Build the **Student Profile Page** (`/student-dashboard/profile`)

**Why?**
- Most important for students
- Uses 8 different server actions (good learning)
- Self-contained (no dependencies on other pages)
- Immediate user value (profile completion)
- Forms the foundation for drive applications

**Estimated time:** 10-12 hours

**Files to create:**
1. `app/(student)/student-dashboard/profile/page.tsx`
2. `components/students/ProfileHeader.tsx`
3. `components/students/PersonalInfoSection.tsx`
4. `components/students/AcademicInfoSection.tsx`
5. Continue with other sections...

All the backend work is done. Time to make it beautiful! 🎨
