-- ARCH-FIX2 unit-7: notification and announcement architecture.
-- Additive only: new enums, columns, tables, constraints and a backfill of
-- existing notification rows. Nothing is dropped or deleted.


-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('INFO', 'SUCCESS', 'ACTION_REQUIRED', 'WARNING', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('DRIVE', 'APPLICATION', 'RECRUITMENT', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('DRIVE_PUBLISHED', 'DRIVE_UPDATED', 'DRIVE_DEADLINE', 'DRIVE_CANCELLED', 'APPLICATION_SUBMITTED', 'APPLICATION_SHORTLISTED', 'APPLICATION_TEST', 'APPLICATION_INTERVIEW', 'APPLICATION_STAGE_CHANGED', 'APPLICATION_SELECTED', 'APPLICATION_REJECTED', 'PLACEMENT_RECORDED', 'PLACEMENT_REVOKED', 'PROFILE_INCOMPLETE', 'ACCOUNT_UPDATE', 'DRIVE_ASSIGNED', 'DRIVE_CONFIG_REMINDER', 'DRIVE_READY_TO_PUBLISH', 'PIPELINE_CHANGE_REVIEWED', 'NEW_APPLICATIONS', 'ACCESS_REQUEST', 'STUDENT_UPDATE', 'ADMIN_DRIVE_DEADLINE', 'MASTER_DRIVE_UPDATED', 'ADMIN_SYSTEM', 'ADMIN_INVITED', 'ADMIN_ACCEPTED_INVITATION', 'DRIVE_ASSIGNMENT', 'DEPARTMENT_CONFIGURED', 'DEPARTMENT_DRIVE_PUBLISHED', 'PIPELINE_CHANGE_REQUESTED', 'APPLICATION_MILESTONE', 'ACCESS_REQUEST_ESCALATED', 'SYSTEM_ALERT', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "NotificationDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('STUDENTS', 'ADMINS', 'EVERYONE');

-- AlterTable
ALTER TABLE "DepartmentAdmin" ADD COLUMN     "firstSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "dispatchId" TEXT,
ADD COLUMN     "event" "NotificationEvent",
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationDispatch" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "status" "NotificationDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "payload" TEXT NOT NULL,
    "departmentId" TEXT,
    "triggeredById" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "mutedEvents" "NotificationEvent"[] DEFAULT ARRAY[]::"NotificationEvent"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "departmentId" TEXT,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'STUDENTS',
    "batchYears" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "priority" "NotificationPriority" NOT NULL DEFAULT 'INFO',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDispatch_key_key" ON "NotificationDispatch"("key");

-- CreateIndex
CREATE INDEX "NotificationDispatch_status_updatedAt_idx" ON "NotificationDispatch"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "NotificationDispatch_event_idx" ON "NotificationDispatch"("event");

-- CreateIndex
CREATE INDEX "Announcement_status_publishAt_idx" ON "Announcement"("status", "publishAt");

-- CreateIndex
CREATE INDEX "Announcement_departmentId_status_idx" ON "Announcement"("departmentId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_category_createdAt_idx" ON "Notification"("userId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_dispatchId_idx" ON "Notification"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "NotificationDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDispatch" ADD CONSTRAINT "NotificationDispatch_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Constraints (hand-written; Prisma cannot express them)
-- ---------------------------------------------------------------------------

-- "Open" always stays inside the app: a path, never another site and never a
-- protocol-relative URL.
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actionUrl_internal"
  CHECK ("actionUrl" IS NULL OR ("actionUrl" LIKE '/%' AND "actionUrl" NOT LIKE '//%' AND char_length("actionUrl") <= 500));

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_dedupeKey_length"
  CHECK ("dedupeKey" IS NULL OR char_length("dedupeKey") BETWEEN 1 AND 300);

-- Read and readAt move together.
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_readAt_matches"
  CHECK ("readAt" IS NULL OR "isRead");

ALTER TABLE "NotificationDispatch" ADD CONSTRAINT "NotificationDispatch_counts"
  CHECK ("attempts" >= 1 AND "recipientCount" >= 0);

ALTER TABLE "NotificationDispatch" ADD CONSTRAINT "NotificationDispatch_sent_completed"
  CHECK ("status" <> 'SENT' OR "completedAt" IS NOT NULL);

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_title_length"
  CHECK (char_length(btrim("title")) BETWEEN 1 AND 200);

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_content_length"
  CHECK (char_length(btrim("content")) BETWEEN 1 AND 10000);

-- A scheduled or published announcement has a moment it becomes visible and
-- a moment it was released.
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_published_has_dates"
  CHECK ("status" NOT IN ('SCHEDULED', 'PUBLISHED') OR ("publishAt" IS NOT NULL AND "publishedAt" IS NOT NULL));

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_archived_has_date"
  CHECK (("status" = 'ARCHIVED') = ("archivedAt" IS NOT NULL));

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_expiry_after_publish"
  CHECK ("expiresAt" IS NULL OR "publishAt" IS NULL OR "expiresAt" > "publishAt");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_attachment_pair"
  CHECK (("attachmentUrl" IS NULL) = ("attachmentName" IS NULL));

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_batchYears_not_null"
  CHECK ("batchYears" IS NOT NULL);

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_mutedEvents_not_null"
  CHECK ("mutedEvents" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------

-- Admins who exist today are not "accepting an invitation" the next time they
-- sign in.
UPDATE "DepartmentAdmin" SET "firstSeenAt" = "createdAt" WHERE "firstSeenAt" IS NULL;

-- Existing notifications get the event, category, priority and link the
-- registry would have given them. Matched on what their producers wrote;
-- anything unrecognised keeps the defaults (SYSTEM, INFO, no event).
UPDATE "Notification" SET "event" = 'APPLICATION_SUBMITTED', "category" = 'APPLICATION', "priority" = 'SUCCESS'
  WHERE "type" = 'APPLICATION' AND "title" = 'Application Submitted';

UPDATE "Notification" SET "event" = 'APPLICATION_SELECTED', "category" = 'RECRUITMENT', "priority" = 'SUCCESS'
  WHERE "type" = 'APPLICATION' AND "event" IS NULL AND "message" ~* '\mmarked selected\M';

UPDATE "Notification" SET "event" = 'APPLICATION_REJECTED', "category" = 'RECRUITMENT', "priority" = 'WARNING'
  WHERE "type" = 'APPLICATION' AND "event" IS NULL AND "message" ~* '\mmarked rejected\M';

UPDATE "Notification" SET "event" = 'APPLICATION_STAGE_CHANGED', "category" = 'RECRUITMENT', "priority" = 'INFO'
  WHERE "type" = 'APPLICATION' AND "event" IS NULL;

UPDATE "Notification" SET "event" = 'DRIVE_PUBLISHED', "category" = 'DRIVE', "priority" = 'INFO'
  WHERE "type" = 'DRIVE' AND "title" = 'New Drive Available';

UPDATE "Notification" SET "event" = 'DRIVE_CANCELLED', "category" = 'DRIVE', "priority" = 'WARNING'
  WHERE "type" = 'DRIVE' AND "title" = 'Drive cancelled';

UPDATE "Notification" SET "event" = 'DRIVE_DEADLINE', "category" = 'DRIVE', "priority" = 'INFO'
  WHERE "type" = 'DRIVE' AND "title" = 'Deadline extended';

UPDATE "Notification" SET "category" = 'DRIVE'
  WHERE "type" = 'DRIVE' AND "event" IS NULL;

UPDATE "Notification" SET "event" = 'ADMIN_SYSTEM', "category" = 'DRIVE', "priority" = 'WARNING'
  WHERE "type" = 'ADMIN' AND "title" = 'Drive cancelled by the Super Admin';

UPDATE "Notification" SET "event" = 'ACCOUNT_UPDATE', "category" = 'SYSTEM', "priority" = 'INFO'
  WHERE "type" = 'ADMIN' AND "title" IN ('Student access approved', 'Student access declined');

-- A department broadcast (the old "announcement", which was only
-- notifications).
UPDATE "Notification" SET "event" = 'ANNOUNCEMENT', "category" = 'ANNOUNCEMENT', "priority" = 'INFO'
  WHERE "type" = 'ADMIN' AND "resourceType" = 'ANNOUNCEMENT' AND "event" IS NULL;

UPDATE "Notification" SET "event" = 'PROFILE_INCOMPLETE', "category" = 'SYSTEM', "priority" = 'ACTION_REQUIRED'
  WHERE "type" = 'PROFILE';

-- Links, for the rows whose producers only stored a resource. All of these
-- went to students.
UPDATE "Notification" SET "actionUrl" = '/student-dashboard/drives/' || "resourceId"
  WHERE "resourceType" = 'Drive' AND "resourceId" IS NOT NULL AND "resourceId" ~ '^[a-z0-9]+$' AND "type" IN ('DRIVE', 'APPLICATION');

UPDATE "Notification" SET "actionUrl" = '/student-dashboard/profile'
  WHERE "resourceType" = 'Profile';

UPDATE "Notification" SET "actionUrl" = '/student-dashboard'
  WHERE "event" = 'ACCOUNT_UPDATE' AND "title" = 'Student access approved';

UPDATE "Notification" SET "readAt" = "createdAt" WHERE "isRead" AND "readAt" IS NULL;
