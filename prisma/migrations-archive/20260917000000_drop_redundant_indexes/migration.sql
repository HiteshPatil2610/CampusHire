-- Drop indexes that duplicate the leftmost column of an existing index or
-- unique constraint on the same table. Postgres serves a lookup on a column
-- from any btree whose leftmost column it is, so each of these was a second
-- copy that no query could ever prefer — and that every insert and update
-- had to maintain.
--
-- Covered by a UNIQUE constraint on the same column:
DROP INDEX "User_clerkId_idx";
DROP INDEX "User_email_idx";
DROP INDEX "Department_code_idx";
DROP INDEX "Student_userId_idx";
DROP INDEX "Student_rollNumber_idx";
DROP INDEX "Student_email_idx";
DROP INDEX "StudentAcademic_studentId_idx";
DROP INDEX "StudentPreferences_studentId_idx";

-- Covered as the leftmost column of a composite index or unique constraint:
DROP INDEX "SemesterMark_studentId_idx";            -- @@unique([studentId, semester])
DROP INDEX "StudentSkill_studentId_idx";            -- @@unique([studentId, skillName])
DROP INDEX "DriveApplication_studentId_idx";        -- @@unique([studentId, driveId])
DROP INDEX "StudentAccessRequest_departmentId_idx"; -- @@index([departmentId, status])
DROP INDEX "Notification_userId_idx";               -- @@index([userId, isRead])
