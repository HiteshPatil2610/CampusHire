# Component Architecture Tree

Visual representation of the component hierarchy for the CampusHire frontend.

---

## 🏗️ Layout Structure

```
app/
├── layout.tsx (Root Layout with ClerkProvider)
│   └── components/layout/
│       ├── Header.tsx
│       │   ├── Logo
│       │   ├── Navigation (role-based)
│       │   ├── NotificationBell.tsx ✅
│       │   └── UserMenu
│       ├── Sidebar.tsx (optional, for admin views)
│       └── Footer.tsx
│
├── (auth)/
│   ├── layout.tsx (Auth Layout)
│   └── sign-in/[[...sign-in]]/page.tsx ✅
│   └── sign-up/[[...sign-up]]/page.tsx ✅
│
├── (student)/
│   ├── layout.tsx (Student Layout with role check)
│   └── student-dashboard/
│       ├── page.tsx ✅ (Dashboard)
│       ├── profile/
│       │   └── page.tsx (Profile Page)
│       ├── drives/
│       │   ├── page.tsx (Available Drives)
│       │   └── [id]/page.tsx (Drive Detail)
│       └── applications/
│           └── page.tsx (My Applications)
│
├── (admin)/
│   ├── layout.tsx (Admin Layout with role check)
│   └── admin-dashboard/
│       ├── page.tsx ✅ (Dashboard)
│       ├── drives/
│       │   ├── page.tsx (Drive Management)
│       │   ├── new/page.tsx (Create Drive)
│       │   ├── [id]/
│       │   │   ├── edit/page.tsx (Edit Drive)
│       │   │   └── applications/page.tsx (View Applications)
│       └── bulk-import/
│           └── page.tsx (Bulk Import - future)
│
├── (super-admin)/
│   ├── layout.tsx (Super Admin Layout with role check)
│   └── super-admin-dashboard/
│       ├── page.tsx ✅ (Dashboard)
│       ├── departments/
│       │   ├── page.tsx (Departments List)
│       │   └── [id]/page.tsx (Department Detail)
│       ├── admins/
│       │   └── page.tsx (Admin Accounts)
│       └── audit-logs/
│           └── page.tsx ✅ (Audit Logs - needs enhancement)
│
└── notifications/
    └── page.tsx ✅ (Universal Notifications Page)
```

---

## 📦 Component Library Structure

### 1️⃣ Student Components

```
components/students/
│
├── RegistrationForm.tsx ✅
│   ├── DepartmentSelector
│   └── FormFields
│
├── ProfileHeader.tsx
│   ├── ProfilePhoto
│   ├── PhotoUploadDialog
│   ├── CompletionProgress
│   └── EditProfileButton
│
├── PersonalInfoSection.tsx
│   ├── EditableField
│   ├── LinkInput (LinkedIn, GitHub, Portfolio)
│   └── SaveButton
│
├── AcademicInfoSection.tsx
│   ├── MarksInput (10th, 12th)
│   ├── CGPAInput
│   ├── SemesterInput
│   ├── BacklogsInput
│   └── SaveButton
│
├── SkillsSection.tsx
│   ├── SkillTag
│   ├── SkillInput (with autocomplete)
│   ├── AddSkillButton
│   └── RemoveSkillButton
│
├── ProjectsSection.tsx
│   ├── ProjectCard
│   │   ├── ProjectTitle
│   │   ├── ProjectDescription
│   │   ├── TechnologyTags
│   │   ├── ProjectDates
│   │   └── EditDeleteButtons
│   ├── AddProjectDialog
│   └── EditProjectDialog
│
├── ExperienceSection.tsx
│   ├── ExperienceCard
│   │   ├── CompanyName
│   │   ├── RoleTitle
│   │   ├── Description
│   │   ├── DateRange
│   │   └── EditDeleteButtons
│   ├── AddExperienceDialog
│   └── EditExperienceDialog
│
├── CertificationsSection.tsx
│   ├── CertificationCard
│   │   ├── CertificationName
│   │   ├── Issuer
│   │   ├── DateRange
│   │   ├── CredentialURL
│   │   └── EditDeleteButtons
│   ├── AddCertificationDialog
│   └── EditCertificationDialog
│
└── PreferencesSection.tsx
    ├── RolePreferences (multi-select)
    ├── LocationPreferences (multi-select)
    ├── CompanyTypePreferences (multi-select)
    ├── PackageRangeInput
    ├── RelocationToggle
    └── SaveButton
```

### 2️⃣ Drive Components

```
components/drives/
│
├── DriveCard.tsx
│   ├── CompanyLogo
│   ├── CompanyName
│   ├── RoleName
│   ├── PackageRange
│   ├── Location
│   ├── EligibilityBadge.tsx
│   ├── DeadlineCountdown.tsx
│   └── ApplyButton
│
├── DriveFilters.tsx
│   ├── CompanyTypeFilter
│   ├── PackageRangeFilter
│   ├── LocationFilter
│   └── ResetFiltersButton
│
├── DriveSearch.tsx
│   ├── SearchInput
│   └── SearchIcon
│
├── DriveDetailHeader.tsx
│   ├── CompanyLogo
│   ├── CompanyName
│   ├── RoleName
│   ├── PackageDisplay
│   └── DeadlineCountdown.tsx
│
├── DriveRequirements.tsx
│   ├── CGPARequirement
│   ├── BacklogsRequirement
│   ├── DepartmentsRequirement
│   └── RequirementBadge
│
├── DriveDescription.tsx
│   ├── JobDescription (rich text)
│   ├── Responsibilities
│   ├── Requirements
│   └── DownloadJDButton
│
├── EligibilityChecklist.tsx
│   ├── ChecklistItem
│   │   ├── Checkmark/Cross Icon
│   │   ├── Criterion Text
│   │   └── StatusIcon
│   └── EligibilityStatus
│
├── ApplicationButton.tsx
│   ├── ApplyDialog
│   ├── ConfirmationMessage
│   └── LoadingState
│
├── CompanyInfo.tsx
│   ├── CompanyType
│   ├── CompanyWebsite
│   └── CompanyDescription
│
├── DriveTable.tsx (Admin)
│   ├── TableHeader
│   ├── TableRow
│   │   ├── CompanyName
│   │   ├── RoleName
│   │   ├── ApplicationCount
│   │   ├── DriveStatusBadge.tsx
│   │   └── DriveActions.tsx
│   └── Pagination
│
├── DriveStatusBadge.tsx
│   └── Badge (Open/Closed/Upcoming)
│
├── DriveActions.tsx (Admin)
│   ├── EditButton
│   ├── ViewApplicationsButton
│   ├── DeactivateButton
│   └── ConfirmationDialog
│
└── DriveForm.tsx (Admin)
    ├── CompanyFields.tsx
    │   ├── CompanyNameInput
    │   ├── CompanyTypeSelect
    │   └── CompanyLogoUpload
    ├── RoleFields.tsx
    │   ├── RoleNameInput
    │   ├── PackageRangeInputs
    │   └── LocationInput
    ├── EligibilityFields.tsx
    │   ├── CGPAInput
    │   ├── BacklogsInput
    │   └── DepartmentMultiSelect
    ├── DateFields.tsx
    │   └── DeadlinePicker
    ├── JDUpload.tsx
    │   └── FileUploadDropzone
    ├── DescriptionEditor.tsx
    │   └── RichTextEditor
    └── FormActions
        ├── SaveButton
        ├── CancelButton
        └── PreviewButton
```

### 3️⃣ Application Components

```
components/applications/
│
├── ApplicationCard.tsx (Student)
│   ├── CompanyLogo
│   ├── CompanyName
│   ├── RoleName
│   ├── ApplicationStatus.tsx
│   ├── ApplicationDate
│   ├── DeadlineDate
│   └── ViewDriveButton
│
├── ApplicationStatus.tsx
│   └── StatusBadge (Applied/Active/Closed)
│
├── ApplicationTimeline.tsx
│   ├── TimelineItem
│   │   ├── DateDisplay
│   │   └── EventDescription
│   └── ProgressBar
│
└── ApplicationsTable.tsx (Admin)
    ├── TableHeader
    │   ├── NameColumn
    │   ├── RollNumberColumn
    │   ├── DepartmentColumn
    │   ├── CGPAColumn
    │   └── DateColumn
    ├── TableRow
    │   ├── StudentName
    │   ├── RollNumber
    │   ├── Department
    │   ├── CGPA
    │   ├── ApplicationDate
    │   └── ViewProfileButton
    ├── StudentDetailsModal.tsx
    │   └── FullStudentProfile
    ├── ApplicationFilters.tsx
    │   ├── DepartmentFilter
    │   └── CGPAFilter
    └── ExportButton.tsx
        └── ExportToExcelDialog
```

### 4️⃣ Department Components

```
components/departments/
│
├── DepartmentTable.tsx
│   ├── TableHeader
│   ├── TableRow
│   │   ├── DepartmentName
│   │   ├── DepartmentCode
│   │   ├── StatusBadge.tsx
│   │   ├── DepartmentStats.tsx
│   │   └── DepartmentActions.tsx
│   └── Pagination
│
├── StatusBadge.tsx
│   └── Badge (Active/Inactive)
│
├── DepartmentStats.tsx
│   ├── StudentCount
│   ├── AdminCount
│   └── DriveCount
│
├── DepartmentActions.tsx
│   ├── EditButton
│   ├── ViewButton
│   ├── ToggleStatusButton
│   └── ConfirmationDialog
│
├── CreateDepartmentDialog.tsx
│   ├── DialogHeader
│   ├── DepartmentForm
│   │   ├── NameInput
│   │   ├── CodeInput
│   │   └── StatusToggle
│   └── DialogActions
│       ├── CancelButton
│       └── CreateButton
│
├── EditDepartmentDialog.tsx
│   └── (Same structure as Create)
│
└── DepartmentHeader.tsx (Detail Page)
    ├── DepartmentName
    ├── DepartmentCode
    ├── StatusBadge.tsx
    └── EditButton
```

### 5️⃣ Admin Account Components

```
components/admin-accounts/
│
├── AdminTable.tsx
│   ├── TableHeader
│   ├── TableRow
│   │   ├── AdminName
│   │   ├── Email
│   │   ├── Department
│   │   ├── AssignedDate
│   │   └── AdminActions.tsx
│   └── Pagination
│
├── AdminActions.tsx
│   ├── ViewButton
│   ├── RemoveButton
│   └── ConfirmationDialog
│
├── AssignAdminDialog.tsx
│   ├── DialogHeader
│   ├── AssignmentForm
│   │   ├── UserSelector
│   │   │   ├── UserSearch
│   │   │   └── UserDropdown
│   │   └── DepartmentSelector
│   └── DialogActions
│       ├── CancelButton
│       └── AssignButton
│
└── RemoveAdminDialog.tsx
    ├── DialogHeader
    ├── ConfirmationMessage
    │   └── WarningText
    └── DialogActions
        ├── CancelButton
        └── RemoveButton (danger)
```

### 6️⃣ Audit Log Components

```
components/audit/
│
├── AuditLogTable.tsx
│   ├── TableHeader
│   ├── TableRow
│   │   ├── Timestamp
│   │   ├── UserName
│   │   ├── ActionBadge.tsx
│   │   ├── EntityTypeBadge.tsx
│   │   ├── EntityID
│   │   └── ExpandButton
│   ├── ExpandedRow
│   │   └── MetadataViewer.tsx
│   └── Pagination
│
├── AuditFilters.tsx
│   ├── ActionFilter (dropdown)
│   ├── EntityTypeFilter (dropdown)
│   ├── UserFilter (dropdown)
│   ├── DateRangePicker.tsx
│   └── ResetFiltersButton
│
├── ActionBadge.tsx
│   └── ColoredBadge (CREATE/UPDATE/DELETE/etc.)
│
├── EntityTypeBadge.tsx
│   └── Badge (Department/Drive/Student/etc.)
│
├── MetadataViewer.tsx
│   ├── JSONDisplay
│   └── CopyButton
│
└── DateRangePicker.tsx
    ├── FromDateInput
    ├── ToDateInput
    └── QuickFilters (Today/Week/Month)
```

### 7️⃣ Notification Components ✅

```
components/notifications/
│
├── NotificationBell.tsx ✅
│   ├── BellIcon
│   ├── UnreadBadge
│   └── Link to /notifications
│
└── NotificationList.tsx ✅
    ├── NotificationItem
    │   ├── NotificationIcon (by type)
    │   ├── TypeBadge
    │   ├── Title
    │   ├── Message
    │   ├── Timestamp
    │   ├── UnreadIndicator
    │   └── MarkReadButton
    ├── MarkAllReadButton
    ├── EmptyState
    └── Pagination
```

### 8️⃣ Bulk Import Components (Future)

```
components/bulk-import/
│
├── TemplateDownload.tsx
│   ├── DownloadButton
│   └── InstructionsText
│
├── FileUpload.tsx
│   ├── Dropzone
│   ├── FilePreview
│   └── RemoveFileButton
│
├── ValidationResults.tsx
│   ├── SuccessCount
│   ├── ErrorCount
│   └── ErrorTable.tsx
│
├── ErrorTable.tsx
│   ├── TableHeader
│   └── ErrorRow
│       ├── RowNumber
│       ├── ErrorType
│       └── ErrorMessage
│
├── ImportPreview.tsx
│   ├── DataTable
│   └── ConfirmButton
│
├── ProgressIndicator.tsx
│   ├── ProgressBar
│   └── StatusMessage
│
└── ImportHistory.tsx
    ├── HistoryTable
    └── ViewDetailsButton
```

---

## 🎨 Shared/Common Components

### Layout Components
```
components/layout/
│
├── Header.tsx
│   ├── Logo
│   ├── Navigation
│   │   ├── NavItem
│   │   └── NavDropdown
│   ├── NotificationBell.tsx ✅
│   └── UserMenu
│       ├── ProfileLink
│       ├── SettingsLink
│       └── SignOutButton
│
├── Sidebar.tsx
│   ├── SidebarHeader
│   ├── SidebarNav
│   │   ├── NavSection
│   │   └── NavItem
│   └── SidebarFooter
│
├── Footer.tsx
│   ├── CopyrightText
│   └── FooterLinks
│
└── PageHeader.tsx
    ├── PageTitle
    ├── Breadcrumbs
    └── ActionButton
```

### UI Components (Shared)
```
components/ui/
│
├── data-table.tsx
│   ├── TableHeader
│   │   ├── SortableColumn
│   │   └── FilterColumn
│   ├── TableBody
│   ├── TableRow
│   ├── TablePagination
│   └── TableActions
│
├── stat-card.tsx
│   ├── StatIcon
│   ├── StatLabel
│   ├── StatValue
│   └── StatTrend (up/down)
│
├── empty-state.tsx
│   ├── EmptyIcon
│   ├── EmptyMessage
│   └── ActionButton
│
├── loading-skeleton.tsx
│   └── SkeletonBox
│
├── status-badge.tsx
│   └── ColoredBadge
│
├── confirmation-dialog.tsx
│   ├── DialogHeader
│   ├── DialogContent
│   └── DialogActions
│       ├── CancelButton
│       └── ConfirmButton
│
├── file-upload.tsx
│   ├── Dropzone
│   ├── FilePreview
│   ├── UploadProgress
│   └── RemoveButton
│
└── date-range-picker.tsx
    ├── FromDate
    ├── ToDate
    └── CalendarPopover
```

### Form Components
```
components/forms/
│
├── FormField.tsx
│   ├── Label
│   ├── Input/Select/Textarea
│   └── ErrorMessage
│
├── FormError.tsx
│   ├── ErrorIcon
│   └── ErrorText
│
├── FormSection.tsx
│   ├── SectionTitle
│   ├── SectionDescription
│   └── FieldGroup
│
├── SubmitButton.tsx
│   ├── ButtonText
│   └── LoadingSpinner
│
└── FormProgress.tsx (Multi-step)
    ├── StepIndicator
    ├── StepLabel
    └── ProgressBar
```

---

## 🔢 Component Count by Category

| Category | Components | Status |
|----------|-----------|--------|
| **Student** | ~25 | ⏳ Pending |
| **Drives** | ~20 | ⏳ Pending |
| **Applications** | ~8 | ⏳ Pending |
| **Departments** | ~10 | ⏳ Pending |
| **Admin Accounts** | ~6 | ⏳ Pending |
| **Audit Logs** | ~7 | 🟡 Partial |
| **Notifications** | ~3 | ✅ Complete |
| **Bulk Import** | ~10 | ⏳ Future |
| **Layout** | ~8 | 🟡 Partial |
| **Shared UI** | ~15 | 🟡 Partial |
| **Forms** | ~5 | 🟡 Partial |
| **TOTAL** | **~117** | **~20% Done** |

---

## 🎯 Component Reusability Map

### High Reusability (Use Everywhere)
- `Button`, `Input`, `Select`, `Checkbox`, `Radio`
- `Dialog`, `Popover`, `Dropdown`
- `Badge`, `Card`, `Separator`
- `Toast`, `Alert`
- `Skeleton`, `Spinner`

### Medium Reusability (Multiple Features)
- `DataTable` (admin pages, applications)
- `StatusBadge` (drives, applications, departments)
- `StatCard` (all dashboards)
- `EmptyState` (all list pages)
- `ConfirmationDialog` (all delete operations)
- `FileUpload` (profile photo, JD upload, bulk import)
- `DateRangePicker` (audit logs, filters)

### Low Reusability (Feature-Specific)
- Profile sections (student-only)
- Drive forms (admin-only)
- Department forms (super admin-only)
- Audit viewers (super admin-only)

---

## 📐 Component Design Patterns

### Pattern 1: List + Detail
```
DrivesList → DriveCard → DriveDetail
ApplicationsList → ApplicationCard
DepartmentsList → DepartmentRow → DepartmentDetail
```

### Pattern 2: CRUD Forms
```
CreateDialog/EditDialog
├── Form
├── Validation
├── Submit
└── Cancel
```

### Pattern 3: Table with Actions
```
Table
├── Filters
├── Search
├── TableHeader
├── TableRow
│   └── Actions (Edit/Delete/View)
└── Pagination
```

### Pattern 4: Section-Based Editing
```
ProfileSection
├── ViewMode
│   ├── DisplayFields
│   └── EditButton
└── EditMode
    ├── FormFields
    ├── SaveButton
    └── CancelButton
```

---

This component tree gives you a complete architectural view of all frontend components needed to integrate with your fully-functional backend! 🚀
