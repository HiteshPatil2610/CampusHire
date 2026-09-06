# Frontend Implementation Roadmap

This document outlines all frontend UI components and pages that need to be built to integrate with the completed backend features (Units 01-10).

## Status Legend
- ✅ **Complete** - Fully implemented and tested
- 🟡 **Partial** - Backend complete, UI pending
- ⏳ **Pending** - Not yet started

---

## Unit 04: Student Registration & Profile Management 🟡

**Backend Status:** ✅ Complete  
**Frontend Status:** Registration form complete, profile pages pending

### Pages to Build

#### 1. Student Profile Page (`/student-dashboard/profile`)
**Purpose:** View and edit complete student profile  
**Route:** `app/(student)/student-dashboard/profile/page.tsx`

**Components Needed:**
```
components/students/
├── ProfileHeader.tsx          # Photo, name, completion percentage
├── PersonalInfoSection.tsx    # Name, roll, phone, links
├── AcademicInfoSection.tsx    # 10th, 12th, CGPA, backlogs
├── SkillsSection.tsx          # Technical & soft skills list
├── ProjectsSection.tsx        # Project cards with edit/delete
├── ExperienceSection.tsx      # Experience timeline
├── CertificationsSection.tsx  # Certification cards
└── PreferencesSection.tsx     # Job preferences form
```

**Features:**
- Section-wise editing (each section has edit/save mode)
- Profile photo upload with preview
- Progress bar showing completion percentage
- Validation feedback for each section
- Skills: Add/remove with autocomplete
- Projects/Experience/Certifications: CRUD operations
- Real-time completion percentage updates

**Server Actions Used:**
- `features/students/actions/profile-personal.ts`
- `features/students/actions/profile-academic.ts`
- `features/students/actions/profile-skills.ts`
- `features/students/actions/profile-projects.ts`
- `features/students/actions/profile-experience.ts`
- `features/students/actions/profile-certifications.ts`
- `features/students/actions/profile-preferences.ts`
- `features/students/actions/profile-photo.ts`

**Queries Used:**
- `features/students/queries/get-profile.ts`
- `features/students/queries/profile-completion.ts`

---

## Unit 05: Drive Management & Eligibility 🟡

**Backend Status:** ✅ Complete  
**Frontend Status:** No UI built yet

### A. Student-Facing Pages

#### 1. Available Drives Page (`/student-dashboard/drives`)
**Purpose:** Browse and filter drives student is eligible for  
**Route:** `app/(student)/student-dashboard/drives/page.tsx`

**Components Needed:**
```
components/drives/
├── DriveCard.tsx              # Single drive summary card
├── DriveFilters.tsx           # Filter by company, role, package
├── DriveSearch.tsx            # Search drives
├── EligibilityBadge.tsx       # Show eligibility status
└── DeadlineCountdown.tsx      # Time remaining to apply
```

**Features:**
- Grid/list view toggle
- Filter by: company type, role, package range, location
- Search by company name or role
- Sort by: deadline, package, posted date
- Eligibility badge on each card
- "Apply Now" button (enabled only for eligible drives)
- Pagination

**Queries Used:**
- `features/drives/queries/get-available-drives.ts` (needs to be created)
- `features/drives/queries/check-eligibility.ts`

#### 2. Drive Detail Page (`/student-dashboard/drives/[id]`)
**Purpose:** View full drive details and apply  
**Route:** `app/(student)/student-dashboard/drives/[id]/page.tsx`

**Components Needed:**
```
components/drives/
├── DriveDetailHeader.tsx      # Company logo, name, role
├── DriveRequirements.tsx      # CGPA, backlogs, departments
├── DriveDescription.tsx       # Full JD, responsibilities
├── EligibilityChecklist.tsx   # Show what criteria student meets
├── ApplicationButton.tsx      # Apply/Applied/Not Eligible states
└── CompanyInfo.tsx            # Company details, website link
```

**Features:**
- Full job description with formatting
- Download JD PDF button
- Eligibility checklist (green checkmarks for met criteria)
- Application status (not applied, applied, deadline passed)
- One-click apply with confirmation dialog
- Redirect to applications page after successful application
- Toast notifications for success/error

**Server Actions Used:**
- `features/applications/actions/apply-to-drive.ts`

**Queries Used:**
- `features/drives/queries/get-drive-by-id.ts` (needs to be created)
- `features/drives/queries/check-eligibility.ts`

#### 3. My Applications Page (`/student-dashboard/applications`)
**Purpose:** View application history and status  
**Route:** `app/(student)/student-dashboard/applications/page.tsx`

**Components Needed:**
```
components/applications/
├── ApplicationCard.tsx        # Single application summary
├── ApplicationStatus.tsx      # Status badge (pending, etc.)
└── ApplicationTimeline.tsx    # Applied date, deadline
```

**Features:**
- List of all submitted applications
- Show company, role, applied date
- Filter by status (active drives vs closed)
- Sort by application date
- View drive details link
- Pagination
- Empty state for no applications

**Queries Used:**
- `features/applications/queries/get-my-applications.ts`

### B. Department Admin Pages

#### 4. Drive Management Dashboard (`/admin-dashboard/drives`)
**Purpose:** Create, edit, and manage drives  
**Route:** `app/(admin)/admin-dashboard/drives/page.tsx`

**Components Needed:**
```
components/drives/
├── DriveTable.tsx             # List all drives (admin view)
├── DriveStatusBadge.tsx       # Open/Closed/Upcoming status
├── CreateDriveButton.tsx      # Opens create dialog
└── DriveActions.tsx           # Edit, deactivate, view applications
```

**Features:**
- Table view with sorting and filtering
- Create new drive button (opens dialog/modal)
- Edit drive details
- View application count
- Deactivate/reactivate drives
- Filter by status (open, closed, upcoming)
- Search by company name
- Pagination

**Server Actions Used:**
- `features/drives/actions/create-drive.ts` (needs to be created)
- `features/drives/actions/update-drive.ts` (needs to be created)
- `features/drives/actions/toggle-drive-status.ts` (needs to be created)

**Queries Used:**
- `features/drives/queries/get-department-drives.ts` (needs to be created)

#### 5. Create/Edit Drive Page (`/admin-dashboard/drives/new` or `/admin-dashboard/drives/[id]/edit`)
**Purpose:** Form to create or edit drive details  
**Route:** `app/(admin)/admin-dashboard/drives/new/page.tsx`

**Components Needed:**
```
components/drives/
├── DriveForm.tsx              # Main form component
├── EligibilityFields.tsx      # CGPA, backlogs, departments
├── CompanyFields.tsx          # Company name, type, logo
├── RoleFields.tsx             # Role, package, location
├── DateFields.tsx             # Application deadline
├── JDUpload.tsx               # PDF upload for JD
└── FormValidation.tsx         # Real-time validation feedback
```

**Features:**
- Multi-section form (company, role, eligibility, dates)
- Real-time validation
- Department selection (scoped to admin's department)
- CGPA range selector
- Backlogs dropdown (0-5+)
- Package range inputs (min/max CTC)
- Date picker for deadline
- JD PDF upload with Vercel Blob
- Rich text editor for description
- Preview mode before saving
- Save as draft functionality

**Server Actions Used:**
- `features/drives/actions/create-drive.ts`
- `features/drives/actions/update-drive.ts`

**Validation Used:**
- `features/drives/schemas/drive.ts` (needs to be created)

#### 6. Drive Applications Page (`/admin-dashboard/drives/[id]/applications`)
**Purpose:** View all applications for a specific drive  
**Route:** `app/(admin)/admin-dashboard/drives/[id]/applications/page.tsx`

**Components Needed:**
```
components/applications/
├── ApplicationsTable.tsx      # List all applicants
├── StudentDetailsModal.tsx    # View student profile
├── ExportButton.tsx           # Export to Excel
└── ApplicationFilters.tsx     # Filter by CGPA, department
```

**Features:**
- Table with student details (name, roll, CGPA, department)
- View full student profile in modal
- Filter by department, CGPA range
- Sort by application date, CGPA
- Export applications to Excel
- Download all resumes as ZIP (future)
- Pagination
- Application count statistics

**Queries Used:**
- `features/applications/queries/get-drive-applications.ts` (needs to be created)

---

## Unit 08: Department & Admin Account Management 🟡

**Backend Status:** ✅ Complete  
**Frontend Status:** No UI built yet

### Super Admin Pages

#### 7. Departments Management Page (`/super-admin-dashboard/departments`)
**Purpose:** Manage all college departments  
**Route:** `app/(super-admin)/super-admin-dashboard/departments/page.tsx`

**Components Needed:**
```
components/departments/
├── DepartmentTable.tsx        # List all departments
├── CreateDepartmentDialog.tsx # Modal to create department
├── EditDepartmentDialog.tsx   # Modal to edit department
├── DepartmentActions.tsx      # Edit, activate/deactivate
├── DepartmentStats.tsx        # Student/admin/drive counts
└── StatusBadge.tsx            # Active/Inactive status
```

**Features:**
- Table with department name, code, status
- Create new department button
- Edit department details
- Activate/deactivate toggle
- View student count, admin count, drive count
- Search by name or code
- Filter by status (active/inactive)
- Pagination
- Confirmation dialogs for status changes

**Server Actions Used:**
- `features/departments/actions/create-department.ts`
- `features/departments/actions/update-department.ts`
- `features/departments/actions/toggle-department-status.ts`

**Queries Used:**
- `features/departments/queries/get-departments.ts`
- `features/departments/queries/get-department-detail.ts`

#### 8. Department Detail Page (`/super-admin-dashboard/departments/[id]`)
**Purpose:** View detailed department information  
**Route:** `app/(super-admin)/super-admin-dashboard/departments/[id]/page.tsx`

**Components Needed:**
```
components/departments/
├── DepartmentHeader.tsx       # Name, code, status
├── StatsCards.tsx             # Student/admin/drive counts
├── AdminsList.tsx             # List of department admins
└── RecentActivity.tsx         # Recent drives, applications
```

**Features:**
- Department overview with statistics
- List of assigned admins
- Recent drives posted
- Recent applications
- Edit department button
- View students button (link to filtered student list)

**Queries Used:**
- `features/departments/queries/get-department-detail.ts`
- `features/departments/queries/get-department-stats.ts`

#### 9. Admin Accounts Page (`/super-admin-dashboard/admins`)
**Purpose:** Manage department admin assignments  
**Route:** `app/(super-admin)/super-admin-dashboard/admins/page.tsx`

**Components Needed:**
```
components/admin-accounts/
├── AdminTable.tsx             # List all admins
├── AssignAdminDialog.tsx      # Modal to assign new admin
├── RemoveAdminDialog.tsx      # Confirmation dialog
└── AdminActions.tsx           # View, remove actions
```

**Features:**
- Table with admin name, email, department, assigned date
- Assign new admin button
- User selection dropdown (shows available users)
- Department selection dropdown
- Remove admin with confirmation
- Filter by department
- Search by name or email
- Pagination
- Role badge display

**Server Actions Used:**
- `features/admin-accounts/actions/assign-department-admin.ts`
- `features/admin-accounts/actions/remove-department-admin.ts`

**Queries Used:**
- `features/admin-accounts/queries/get-department-admins.ts`
- `features/admin-accounts/queries/get-available-users.ts`

---

## Unit 09: Audit Logging 🟡

**Backend Status:** ✅ Complete  
**Frontend Status:** No UI built yet

#### 10. Audit Logs Page (`/super-admin-dashboard/audit-logs`)
**Purpose:** View system activity logs  
**Route:** `app/(super-admin)/super-admin-dashboard/audit-logs/page.tsx` (exists but needs enhancement)

**Components Needed:**
```
components/audit/
├── AuditLogTable.tsx          # List all audit entries
├── AuditFilters.tsx           # Filter by action, entity, user, date
├── ActionBadge.tsx            # Color-coded action type
├── EntityTypeBadge.tsx        # Entity type badge
├── MetadataViewer.tsx         # JSON metadata display
└── DateRangePicker.tsx        # Filter by date range
```

**Features:**
- Table with timestamp, user, action, entity, metadata
- Filter by:
  - Action type (CREATE, UPDATE, DELETE, etc.)
  - Entity type (Department, Drive, Student, etc.)
  - User (dropdown of all users)
  - Date range (from/to date pickers)
- Search by entity ID
- Sort by timestamp (newest first)
- Expandable rows to view full metadata
- Export to CSV
- Pagination
- Color-coded action badges

**Queries Used:**
- `features/audit/queries/get-audit-logs.ts`

**Enhancements Needed:**
- Add filters (currently just pagination)
- Add metadata viewer
- Add export functionality

---

## Unit 10: Notifications ✅

**Backend Status:** ✅ Complete  
**Frontend Status:** ✅ Mostly complete, layout integration pending

#### 11. Notifications Page (`/notifications`)
**Status:** ✅ Complete

**Components:** ✅ Complete
- `components/notifications/NotificationList.tsx`
- `components/notifications/NotificationBell.tsx`

**Pending Integration:**
- Add NotificationBell to header/nav in all layouts
- Add deep linking (click notification → navigate to resource)
- Add real-time updates (polling or WebSocket)

---

## Unit 07: Excel/CSV Bulk Import ⏳

**Backend Status:** 🟡 Specification complete, implementation pending  
**Frontend Status:** ⏳ Not started

#### 12. Bulk Import Page (`/admin-dashboard/bulk-import`)
**Purpose:** Upload and import student data via Excel/CSV  
**Route:** `app/(admin)/admin-dashboard/bulk-import/page.tsx`

**Components Needed:**
```
components/bulk-import/
├── TemplateDownload.tsx       # Download Excel template
├── FileUpload.tsx             # Drag-and-drop file upload
├── ValidationResults.tsx      # Show validation errors
├── ImportPreview.tsx          # Preview data before import
├── ErrorTable.tsx             # Table of validation errors
├── ProgressIndicator.tsx      # Import progress bar
└── ImportHistory.tsx          # Past import records
```

**Features:**
- Download template button (generates Excel with headers)
- Drag-and-drop file upload (Excel/CSV)
- Real-time validation as file uploads
- Preview parsed data in table
- Show validation errors grouped by type
- Row-by-row error display
- Confirm import button (disabled if errors)
- Progress bar during import
- Success/failure toast notifications
- View import history with counts

**Server Actions Needed:**
- `features/excel-import/actions/upload-file.ts`
- `features/excel-import/actions/validate-import.ts`
- `features/excel-import/actions/execute-import.ts`
- `features/excel-import/actions/generate-template.ts`

---

## Common/Shared Components Needed

### Layout Components

```
components/layout/
├── Header.tsx                 # Top navigation bar
│   ├── NotificationBell integration
│   └── User profile dropdown
├── Sidebar.tsx                # Side navigation
│   ├── Role-based menu items
│   └── Active route highlighting
├── Footer.tsx                 # Footer with links
└── PageHeader.tsx             # Reusable page title component
```

### UI Components (extend shadcn/ui)

```
components/ui/
├── data-table.tsx             # Reusable table with sorting/filtering
├── date-range-picker.tsx      # Date range selection
├── file-upload.tsx            # Drag-and-drop file upload
├── stat-card.tsx              # Statistics display card
├── status-badge.tsx           # Colored status badges
├── empty-state.tsx            # Empty state placeholder
├── loading-skeleton.tsx       # Loading skeletons
├── confirmation-dialog.tsx    # Reusable confirmation modal
└── toast.tsx                  # Toast notifications (may exist)
```

### Form Components

```
components/forms/
├── FormField.tsx              # Wrapper for form fields
├── FormError.tsx              # Error message display
├── FormSection.tsx            # Grouped form fields
├── SubmitButton.tsx           # Loading state button
└── FormProgress.tsx           # Multi-step form progress
```

---

## Implementation Priority

### Phase 1: High Priority (Core Student Experience)
1. ✅ Student Dashboard (basic version exists)
2. **Student Profile Page** - Complete profile editing
3. **Available Drives Page** - Browse eligible drives
4. **Drive Detail Page** - View drive and apply
5. **My Applications Page** - View application history

### Phase 2: Medium Priority (Admin Experience)
6. **Drive Management Dashboard** - Admin drive list
7. **Create/Edit Drive Page** - Drive CRUD
8. **Drive Applications Page** - View applicants
9. **Notification Layout Integration** - Add bell to header

### Phase 3: Lower Priority (Super Admin)
10. **Departments Management Page**
11. **Department Detail Page**
12. **Admin Accounts Page**
13. **Enhanced Audit Logs Page**

### Phase 4: Optional (Advanced Features)
14. **Bulk Import Page** (requires Unit 07 backend implementation)
15. Real-time notifications (WebSocket/polling)
16. Deep linking from notifications
17. Export features (applications to Excel, etc.)

---

## Development Guidelines

### Styling
- Use CampusHire design tokens from `app/globals.css`
- Follow existing color variables (`--primary`, `--secondary`, etc.)
- Use Tailwind utility classes
- Maintain responsive design (mobile-first)

### Forms
- Use React Hook Form + Zod validation
- Match backend validation schemas
- Show real-time validation feedback
- Disable submit during loading
- Show toast notifications for success/error

### Data Fetching
- Use server components where possible
- Client components for interactivity
- Use React Query/SWR for client-side data fetching (optional)
- Show loading states (skeletons)
- Show error states with retry

### Authorization
- Check user role in server components
- Redirect unauthorized users
- Use existing auth helpers from `lib/auth.ts`
- Show/hide features based on role

### Accessibility
- Semantic HTML
- Keyboard navigation
- Focus states
- ARIA labels
- Screen reader support

### Testing
- Test user flows (register → profile → apply to drive)
- Test validation (required fields, formats)
- Test authorization (role-based access)
- Test error handling (network errors, validation)

---

## Estimated Effort

**Total Pages:** 12 main pages  
**Total Components:** ~80-100 components  
**Estimated Time:** 80-120 hours for complete implementation

**Breakdown:**
- Phase 1 (Student): ~30-40 hours
- Phase 2 (Admin): ~25-35 hours
- Phase 3 (Super Admin): ~15-20 hours
- Phase 4 (Optional): ~10-25 hours

---

## Next Steps

1. **Start with Phase 1** - Student-facing features provide immediate value
2. **Build shared components first** - Header, Sidebar, DataTable, etc.
3. **Follow existing patterns** - Match NotificationList component style
4. **Test incrementally** - Test each page/component as you build
5. **Integrate notifications** - Add NotificationBell to header early

All backend APIs are ready and tested. The frontend work is primarily UI development and integration.
