# CampusHire — Unit 04: Student Registration & Profile Management

## Current Status

Completed:
- Unit 01 — Project Setup ✅
- Unit 02 — Database & Student Foundation ✅
- Unit 03 — Authentication & Role Synchronization ✅

Now implement the complete:

# Unit 04 — Student Registration & Profile Management

---

## 1. Purpose

Implement the complete student registration flow and profile management experience. This unit enables:

1. Student onboarding after Clerk authentication
2. Complete profile CRUD operations
3. Profile completion tracking
4. Profile photo upload/management
5. Seven-section profile structure

All functionality is student-owned and student-facing. Department admin student management is out of scope for this unit.

---

## 2. Scope

### In Scope

**Registration/Onboarding:**
- Post-authentication student record creation
- Department selection during registration
- Roll number assignment/input
- Student → User linking

**Profile Management:**
- View own profile
- Edit own profile across all seven sections
- Add/edit/remove repeatable records (skills, projects, experience, certifications)
- Profile completion calculation
- Profile completion display

**Profile Photo:**
- Upload profile photo to Vercel Blob
- Store URL reference in database
- Display profile photo
- Update/replace profile photo

**Seven Profile Sections:**
1. Personal (name, phone, LinkedIn/GitHub/portfolio URLs)
2. Academic (10th/12th marks, CGPA, semester, backlogs)
3. Skills & Links (technical/soft skills, social profiles)
4. Projects (title, description, technologies, URL, dates)
5. Experience (company, role, description, dates)
6. Certifications (name, issuer, dates, credential URL)
7. Preferences (roles, locations, company types, package range, relocation)

### Out of Scope

- Department admin student management
- Bulk Excel student upload
- Drive eligibility/applications
- Resume builder/storage
- AI analysis
- Readiness scoring (distinct from profile completion)
- Admin editing student profiles
- Multi-student views
- Student search/roster

---

## 3. Student Registration Flow

### Sequence

1. **Authentication**: Student authenticates via Clerk (college email verification)
2. **User Record**: Clerk webhook creates User record with STUDENT role (Unit 03)
3. **Registration Check**: System detects missing Student record
4. **Registration Form**: Student completes:
   - Full name
   - Roll number
   - Department selection
   - Phone number (optional)
5. **Student Creation**: System creates Student record linked to authenticated User
6. **Redirect**: Student proceeds to profile/dashboard

### Safety Requirements

- Student cannot create Student record for another User
- Student cannot assign themselves DEPT_ADMIN or SUPER_ADMIN role
- Student cannot create duplicate Student records
- Roll number must be unique institution-wide
- Server-side validation and ownership enforcement

### Roll Number Format

**Open Question**: Is there a specific institutional format for roll numbers (e.g., "CS2021001")? 
- Current implementation: validates non-empty string, enforces uniqueness
- Future: add pattern validation if format is defined

---

## 4. Profile Structure

### Database Foundation (from Unit 02)

The profile uses these models:
- `Student` (core fields)
- `StudentAcademic` (1:1 with Student)
- `StudentSkill` (M:1 with Student)
- `StudentProject` (M:1 with Student)
- `StudentExperience` (M:1 with Student)
- `StudentCertification` (M:1 with Student)
- `StudentPreferences` (1:1 with Student)

### Section 1: Personal

**Fields (stored in Student model):**
- Name (required, validated in auth)
- Roll number (required, unique)
- Department (required, foreign key)
- Phone number (optional)
- LinkedIn URL (optional)
- GitHub URL (optional)
- Portfolio URL (optional)
- Profile photo URL (optional, from Vercel Blob)

**Validation:**
- Name: non-empty string
- Roll number: non-empty string, unique
- Phone: optional, format validation if provided
- URLs: optional, valid URL format if provided

### Section 2: Academic

**Fields (stored in StudentAcademic model):**
- 10th percentage (required, 0-100)
- 12th percentage (required, 0-100)
- Current CGPA (required, 0-10 scale assumed)
- Current semester (required, integer 1-8 typical range)
- Active backlogs (required, integer ≥ 0, default 0)

**Validation:**
- Percentages: 0-100
- CGPA: 0-10 (Indian system standard)
- Semester: positive integer
- Backlogs: non-negative integer

**Open Question**: CGPA scale confirmation (0-10 assumed, most common in Indian institutions)

### Section 3: Skills & Links

**Fields (stored in StudentSkill model, many-to-one):**
- Skill name (required)
- Skill type (required, enum: TECHNICAL | SOFT)

**Behavior:**
- Students can add multiple skills
- Duplicate skill names for same student prevented (unique constraint)
- Skills can be removed
- No reordering requirement for V1

**Social Links:**
- Already in Personal section (LinkedIn, GitHub, Portfolio)

### Section 4: Projects

**Fields (stored in StudentProject model, many-to-one):**
- Title (required)
- Description (required, text)
- Technologies used (required, text - stores comma-separated or JSON)
- Project URL (optional)
- Start date (optional)
- End date (optional)

**Behavior:**
- Students can add multiple projects
- Projects can be edited
- Projects can be removed
- No ordering requirement for V1

**Validation:**
- Title: non-empty string
- Description: non-empty text
- Technologies: non-empty text
- URL: valid URL format if provided
- Dates: valid date format if provided

### Section 5: Experience

**Fields (stored in StudentExperience model, many-to-one):**
- Company name (required)
- Role (required)
- Description (required, text)
- Start date (required)
- End date (optional, null = current)

**Behavior:**
- Students can add multiple experiences
- Experiences can be edited
- Experiences can be removed
- No ordering requirement for V1

**Validation:**
- Company name: non-empty string
- Role: non-empty string
- Description: non-empty text
- Start date: valid date, required
- End date: valid date if provided, must be after start date

### Section 6: Certifications

**Fields (stored in StudentCertification model, many-to-one):**
- Certification name (required)
- Issuing organization (required)
- Issue date (required)
- Expiry date (optional)
- Credential URL (optional)

**Behavior:**
- Students can add multiple certifications
- Certifications can be edited
- Certifications can be removed
- No ordering requirement for V1

**Validation:**
- Name: non-empty string
- Organization: non-empty string
- Issue date: valid date, required
- Expiry date: valid date if provided, must be after issue date
- Credential URL: valid URL format if provided

### Section 7: Preferences

**Fields (stored in StudentPreferences model, 1:1 with Student):**
- Preferred roles (required, JSON array stored as text)
- Preferred locations (required, JSON array stored as text)
- Preferred company types (required, JSON array stored as text)
- Expected package min (optional, float)
- Expected package max (optional, float)
- Willing to relocate (required, boolean, default false)

**Behavior:**
- Single preferences record per student
- Created on first edit
- Updated on subsequent edits

**Validation:**
- Roles: JSON array of strings, at least one entry
- Locations: JSON array of strings, at least one entry
- Company types: JSON array of strings, at least one entry
- Package min: positive number if provided
- Package max: positive number if provided, must be ≥ min if both provided

---

## 5. Profile Completion Calculation

### Algorithm

```
Profile completion = (required fields filled) / (total required fields) * 100
```

### Required Fields Checklist

**Personal (4 required):**
1. Name ✓ (validated during registration)
2. Roll number ✓ (validated during registration)
3. Department ✓ (validated during registration)
4. Phone number (OPTIONAL - not counting)

**Academic (5 required):**
1. 10th percentage
2. 12th percentage
3. Current CGPA
4. Current semester
5. Active backlogs (defaults to 0, counts as filled)

**Skills (1 required):**
1. At least one skill entry

**Projects (1 required):**
1. At least one project entry

**Experience (1 required):**
1. At least one experience entry

**Certifications (1 required):**
1. At least one certification entry

**Preferences (5 required):**
1. Preferred roles (at least one)
2. Preferred locations (at least one)
3. Preferred company types (at least one)
4. Willing to relocate (defaults to false, counts as filled)
5. Package expectation min OR max (at least one)

### Total Required Fields: 17

### Completion Formula

```typescript
const totalRequired = 17;
const filled = countFilledRequiredFields(profile);
const completionPercentage = Math.round((filled / totalRequired) * 100);
```

### Important Rules

1. **Simple ratio** - not weighted by section
2. **All sections matter equally** - student needs content in all seven sections for 100%
3. **Defaults count** - if a field has a default value (activeBacklogs = 0, willingToRelocate = false), it counts as filled
4. **At least one** - for repeatable sections (skills, projects, experience, certifications), at least one entry required
5. **No shortcuts** - reaching 100% requires genuine profile completion

### Display

- Show percentage prominently on dashboard/profile
- Show which sections are incomplete
- Show which required fields are missing per section
- Provide clear guidance on what to complete next

---

## 6. Profile Editing Behavior

### Ownership

- Students can ONLY edit their own profile
- Student ID comes from authenticated session (server-side)
- No student can modify another student's profile

### Authorization Pattern

```typescript
const { user, student } = await requireStudent(); // from lib/auth.ts
// All operations use student.id from authenticated session
// Never trust client-provided studentId
```

### Operations

**Update Personal Info:**
- Update Student record fields
- Validate URLs
- Server action

**Update Academic Info:**
- Upsert StudentAcademic (create if missing, update if exists)
- Validate numeric ranges
- Server action

**Manage Skills:**
- Add skill: create StudentSkill
- Remove skill: delete StudentSkill
- Prevent duplicates (unique constraint)
- Server actions

**Manage Projects:**
- Add project: create StudentProject
- Edit project: update StudentProject by id
- Remove project: delete StudentProject by id
- Verify project ownership before edit/delete
- Server actions

**Manage Experience:**
- Add experience: create StudentExperience
- Edit experience: update StudentExperience by id
- Remove experience: delete StudentExperience by id
- Verify experience ownership before edit/delete
- Server actions

**Manage Certifications:**
- Add certification: create StudentCertification
- Edit certification: update StudentCertification by id
- Remove certification: delete StudentCertification by id
- Verify certification ownership before edit/delete
- Server actions

**Update Preferences:**
- Upsert StudentPreferences (create if missing, update if exists)
- Validate JSON arrays
- Server action

---

## 7. Profile Photo Handling

### Architecture

**Storage**: Vercel Blob
**Database**: Store URL reference only in Student.profilePhotoUrl (need to add this field)
**Validation**: File type, file size

### Upload Flow

1. Student selects image file (client)
2. Client uploads to dedicated upload API route
3. API route validates file (type, size)
4. API route uploads to Vercel Blob
5. API route returns Blob URL
6. Client calls server action to update Student.profilePhotoUrl with URL
7. Display updated photo

### Validation

- File types: image/jpeg, image/png, image/webp
- Max size: 5MB
- Dimensions: no restriction for V1 (client can crop/resize)

### Security

- Upload route requires authentication
- Upload route verifies student ownership
- Only authenticated student can upload their own photo
- No hardcoded Blob credentials

### Environment Variables

Need to add to `lib/env.ts`:
- `BLOB_READ_WRITE_TOKEN` (Vercel Blob token)

**Open Question**: Is Vercel Blob already configured? If not, need setup instructions.

---

## 8. Server Actions & Data Access

### Architecture

Follow project conventions:
- Business logic in `features/students/` (NEW)
- Server actions for mutations
- Validation with Zod
- Authorization via lib/auth.ts

### File Structure (NEW)

```
features/
  students/
    actions/
      registration.ts      (createStudent action)
      profile-personal.ts  (updatePersonalInfo action)
      profile-academic.ts  (updateAcademicInfo action)
      profile-skills.ts    (addSkill, removeSkill actions)
      profile-projects.ts  (addProject, updateProject, removeProject actions)
      profile-experience.ts (addExperience, updateExperience, removeExperience actions)
      profile-certifications.ts (addCertification, updateCertification, removeCertification actions)
      profile-preferences.ts (updatePreferences action)
      profile-photo.ts     (updateProfilePhoto action)
    queries/
      get-profile.ts       (getStudentProfile query)
      profile-completion.ts (calculateProfileCompletion utility)
    schemas/
      registration.ts      (Zod schemas for registration)
      profile.ts           (Zod schemas for profile updates)
```

### Validation

All server actions validate input using Zod schemas defined in `features/students/schemas/`.

### Authorization

All server actions use `requireStudent()` from `lib/auth.ts` to:
1. Verify authentication
2. Verify STUDENT role
3. Get authenticated student record
4. Use student.id for all database operations

---

## 9. UI Implementation

### Design System

Follow existing CampusHire theme (ui-context.md):
- Light-only interface
- `--surface-0` background (#FAF9F5)
- `--surface-2` cards (#FFFFFF)
- `--accent` primary color (#D85A30)
- Inter font
- 8px/12px border radius
- Tabler icons

### Components Architecture

```
components/
  shared/
    ProfilePhotoUpload.tsx (photo upload component)
    ProfileCompletionBadge.tsx (completion % display)
  students/ (NEW)
    RegistrationForm.tsx
    ProfilePersonalForm.tsx
    ProfileAcademicForm.tsx
    ProfileSkillsList.tsx
    ProfileProjectsList.tsx
    ProfileExperienceList.tsx
    ProfileCertificationsList.tsx
    ProfilePreferencesForm.tsx
```

### Profile Layout

Use vertical sticky tab pattern (from ui-context.md):
- 190px left sticky tab list
- Seven tabs (Personal, Academic, Skills, Projects, Experience, Certifications, Preferences)
- Active section content on right
- Completion badge in header

### Forms

- Use shadcn/ui form components
- Inline validation
- Clear error messages
- Save buttons per section
- Loading states during save

### Repeatable Sections

For Skills, Projects, Experience, Certifications:
- Card-based list view
- "Add" button to add new entry
- Edit icon on each card
- Remove icon on each card
- Empty state with "Add your first X" message

---

## 10. Pages & Routes

### Registration Page (NEW)

**Route**: `/student-dashboard` (redirect to registration if no Student record)

**Conditional Rendering**:
```typescript
const { user, student } = await getCurrentUserWithStudent();
if (!student) {
  return <RegistrationForm />;
}
return <StudentDashboard student={student} />;
```

### Student Dashboard (MODIFY)

**Route**: `/student-dashboard`

**Features**:
- Welcome message
- Profile completion badge
- Quick actions (Complete Profile, View Drives)
- Recent activity (future)

### Student Profile (NEW)

**Route**: `/student-dashboard/profile`

**Features**:
- Seven-section tab navigation
- Profile completion display
- Edit forms per section
- Profile photo upload

---

## 11. Database Changes

### Required Schema Modification

Need to add `profilePhotoUrl` field to Student model:

```prisma
model Student {
  // ... existing fields ...
  profilePhotoUrl String?  // NEW: URL from Vercel Blob
  // ... rest of model ...
}
```

### Migration

Create migration for the schema change:
```bash
npx prisma migrate dev --name add_profile_photo_url
```

---

## 12. Authorization Rules

### Student Registration

- Authenticated user with STUDENT role
- No existing Student record for this User
- Cannot create Student for another User
- Cannot self-assign admin roles

### Profile Operations

- Authenticated user with STUDENT role
- Must have Student record (registration complete)
- Can only access/modify own profile
- All student IDs come from authenticated session

### Profile Photo Upload

- Authenticated user with STUDENT role
- Must have Student record
- Can only upload for own profile
- File validation enforced server-side

---

## 13. Pagination

Not required for Unit 04. 

Student profile operations are single-student focused. Lists within a profile (skills, projects, etc.) are small and do not require pagination for V1.

Future units (admin student management) will implement pagination per project standards (offset pagination, pageSize = 25).

---

## 14. Error Handling

### Common Cases

**Unauthenticated:**
- Redirect to /sign-in via middleware

**Wrong Role:**
- Reject with AuthorizationError
- Display error message

**Missing Student Record:**
- Redirect to registration flow
- Show registration form

**Invalid Input:**
- Return Zod validation errors
- Display field-level errors in form

**Unauthorized Ownership:**
- Reject with AuthorizationError
- Log attempt (future: audit log)

**Storage Failure (Blob upload):**
- Return error to client
- Do not save invalid URL
- Allow retry

**Database Failure:**
- Catch and log error
- Return user-friendly message
- Do not expose implementation details

---

## 15. Testing

### Test Coverage

Create tests in `features/students/__tests__/`:

**Registration Tests:**
- `registration.test.ts`
  - Authenticated student can complete registration
  - Duplicate Student creation prevented (unique userId)
  - Duplicate roll number rejected (unique rollNumber)
  - Unauthorized user cannot create Student for another user

**Profile Tests:**
- `profile-queries.test.ts`
  - Student can retrieve own profile
  - Student cannot retrieve another student's profile
  - Profile includes all sections
  
- `profile-updates.test.ts`
  - Student can update own profile
  - Student cannot update another student's profile
  - Invalid data rejected (validation)
  - Required fields validated
  
**Completion Tests:**
- `profile-completion.test.ts`
  - Completion calculation uses required fields
  - Completion is simple ratio (not weighted)
  - Missing required fields reduce completion
  - All required fields filled = 100%
  - Defaults (backlogs = 0) count as filled
  - Repeatable sections require at least one entry

**Profile Photo Tests:**
- `profile-photo.test.ts`
  - Valid file types accepted
  - Invalid file types rejected
  - File size limit enforced
  - Authenticated student can upload
  - Profile photo URL saved correctly
  - Mock Blob upload (don't require real Blob in tests)

### Testing Approach

- Use Vitest
- Mock Clerk authentication
- Mock Prisma database
- Mock Vercel Blob for photo upload tests
- Focus on business logic, not external services

---

## 16. Environment Variables

### New Variables Required

Add to `lib/env.ts`:

```typescript
// Vercel Blob
BLOB_READ_WRITE_TOKEN: z.string().min(1),
```

Add to `.env.example`:

```
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

### Setup Requirements

- Vercel Blob must be configured in Vercel project
- Token added to environment variables
- Local development: add to `.env.local`

---

## 17. Verification Plan

Run all checks:

1. **Prisma:**
   ```bash
   npx prisma validate
   npx prisma generate
   ```

2. **Database Migration:**
   ```bash
   npx prisma migrate dev --name add_profile_photo_url
   ```

3. **TypeScript:**
   ```bash
   npx tsc --noEmit
   ```

4. **ESLint:**
   ```bash
   npm run lint
   ```

5. **Tests:**
   ```bash
   npm run test
   ```

6. **Build:**
   ```bash
   npm run build
   ```

7. **Manual Testing (if database connected):**
   - Complete registration flow
   - Edit each profile section
   - Upload profile photo
   - Verify completion calculation
   - Test validation errors

---

## 18. Out of Scope (Explicit)

Do NOT implement:

- Department admin student management
- Bulk Excel student upload
- Student roster/search (admin view)
- Drive posting
- Drive eligibility
- Drive applications
- Application tracking
- Resume builder
- Resume PDF storage
- AI resume analyzer
- Readiness scoring (distinct from completion %)
- Audit logging
- Notifications
- Payments
- Multi-college support
- Native mobile app
- Admin editing student profiles
- Cross-student profile viewing

This unit is ONLY:
**Student Registration + Student Profile Management + Profile Completion + Profile Photo**

---

## 19. Open Questions

1. **Roll Number Format**: Is there a specific institutional format/pattern for roll numbers (e.g., "CS2021001")?
   - Current: validates non-empty string, enforces uniqueness
   - Future: add regex pattern validation if format defined

2. **CGPA Scale**: Confirming 0-10 scale (most common in Indian institutions)?
   - Current: validates 0-10 range
   - Future: adjust if different scale needed

3. **Vercel Blob Setup**: Is Vercel Blob already configured for this project?
   - Need: BLOB_READ_WRITE_TOKEN environment variable
   - Need: Vercel project Blob storage enabled

4. **College Email Domain**: What is the specific college email domain for student registration validation?
   - Current: Clerk handles email verification
   - Future: add domain restriction if specified

---

## 20. Success Criteria

### Registration

✅ Student can complete registration after Clerk authentication
✅ Student record linked to authenticated User
✅ Roll number uniqueness enforced
✅ Department correctly associated
✅ Duplicate prevention works

### Profile Management

✅ Student can view complete profile across all seven sections
✅ Student can edit each section
✅ Student can add/edit/remove repeatable items (skills, projects, etc.)
✅ Validation errors displayed clearly
✅ Changes persist correctly

### Profile Completion

✅ Completion percentage calculates correctly
✅ Simple ratio algorithm (not weighted)
✅ All 18 required fields counted
✅ Defaults count as filled
✅ Completion updates immediately after save
✅ UI shows which sections incomplete

### Profile Photo

✅ Student can upload profile photo
✅ File validation works (type, size)
✅ Photo uploads to Vercel Blob
✅ URL saved to database
✅ Photo displays correctly

### Authorization

✅ All operations require authentication
✅ Student role enforced
✅ Student can only access own profile
✅ Ownership verified server-side
✅ Cannot modify another student's data

### Code Quality

✅ TypeScript compilation passes
✅ ESLint passes
✅ All tests pass
✅ Build succeeds
✅ No console errors

---

## Summary

Unit 04 implements the complete student-facing registration and profile management system. Students can:
1. Complete registration after email verification
2. Build comprehensive profiles across seven sections
3. Track profile completion progress
4. Upload profile photos
5. Manage all profile data with full CRUD operations

All operations are student-owned, server-side authorized, and validated. The foundation is now ready for Unit 05 (Excel bulk upload) and Unit 06 (Drive posting and eligibility).
