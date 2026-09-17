-- Baseline.
--
-- The migration history this replaces could not build a database: six tables
-- (Drive, DriveApplication, DriveDepartmentConfig, AuditLog, Notification,
-- SemesterMark) were never created by any migration — they had been applied to
-- the development database by hand, so `prisma migrate status` reported
-- "up to date" while `migrate deploy` against a fresh database failed at the
-- first ALTER TABLE on a table that did not exist. The old files are kept
-- under prisma/migrations/_archive for reference; they are not replayable.
--
-- This file is generated from the schema and creates the whole thing. It is
-- marked as already-applied on databases that predate it, so no DDL runs
-- against them.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'DEPT_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('TECHNICAL', 'SOFT');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('REGULAR', 'DIPLOMA');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApplyMethod" AS ENUM ('IN_APP', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('APPLIED', 'APTITUDE', 'INTERVIEW', 'OFFER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('IN_PROGRESS', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "departmentId" TEXT NOT NULL,
    "rollNumber" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "isPending" BOOLEAN NOT NULL DEFAULT true,
    "profilePhotoUrl" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "personalEmail" TEXT,
    "batchYear" INTEGER,
    "entryType" "EntryType" NOT NULL DEFAULT 'REGULAR',
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "optedInLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterMark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "sgpa" DOUBLE PRECISION NOT NULL,
    "gradeCardUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemesterMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAcademic" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tenthPercentage" DOUBLE PRECISION NOT NULL,
    "tenthBoard" TEXT,
    "tenthYear" INTEGER,
    "tenthMarksheetUrl" TEXT,
    "twelfthPercentage" DOUBLE PRECISION,
    "twelfthBoard" TEXT,
    "twelfthYear" INTEGER,
    "twelfthMarksheetUrl" TEXT,
    "diplomaPercentage" DOUBLE PRECISION,
    "diplomaBoard" TEXT,
    "diplomaYear" INTEGER,
    "diplomaMarksheetUrl" TEXT,
    "currentCGPA" DOUBLE PRECISION NOT NULL,
    "currentSemester" INTEGER NOT NULL,
    "activeBacklogs" INTEGER NOT NULL DEFAULT 0,
    "pastBacklogCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAcademic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSkill" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "skillType" "SkillType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProject" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "technologiesUsed" TEXT NOT NULL,
    "projectUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentExperience" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCertification" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "certificationName" TEXT NOT NULL,
    "issuingOrganization" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "credentialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPreferences" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "preferredRoles" TEXT NOT NULL,
    "preferredLocations" TEXT NOT NULL,
    "preferredCompanyTypes" TEXT NOT NULL,
    "workMode" TEXT NOT NULL DEFAULT '[]',
    "expectedPackageMin" DOUBLE PRECISION,
    "expectedPackageMax" DOUBLE PRECISION,
    "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drive" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT,
    "createdByUserId" TEXT,
    "isCentralDrive" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "jobDescriptionUrl" TEXT,
    "jobDescriptionText" TEXT,
    "packageOffered" DOUBLE PRECISION NOT NULL,
    "selectionRounds" TEXT NOT NULL,
    "driveDate" TIMESTAMP(3) NOT NULL,
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "applyMethod" "ApplyMethod" NOT NULL,
    "externalApplyUrl" TEXT,
    "minCGPA" DOUBLE PRECISION NOT NULL,
    "maxActiveBacklogs" INTEGER NOT NULL,
    "eligibleDepartments" TEXT NOT NULL,
    "companyLogoUrl" TEXT,
    "packageDisplay" TEXT,
    "venue" TEXT,
    "reportingTime" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "pptLink" TEXT,
    "applicationFields" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveDepartmentConfig" (
    "id" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "venue" TEXT,
    "reportingTime" TEXT,
    "coordinatorName" TEXT,
    "coordinatorPhone" TEXT,
    "coordinatorEmail" TEXT,
    "seatingAllocation" TEXT,
    "pptLink" TEXT,
    "specialInstructions" TEXT,
    "applicationFields" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveDepartmentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveApplication" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'APPLIED',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "snapshotCgpa" DOUBLE PRECISION,
    "snapshotBacklogs" INTEGER,
    "submittedDetails" TEXT,
    "consentAcceptedAt" TIMESTAMP(3),
    "stageUpdatedAt" TIMESTAMP(3),
    "stageUpdatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rollNumber" TEXT,
    "departmentId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "entryType" "EntryType" NOT NULL DEFAULT 'REGULAR',
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentAdmin_userId_key" ON "DepartmentAdmin"("userId");

-- CreateIndex
CREATE INDEX "DepartmentAdmin_departmentId_idx" ON "DepartmentAdmin"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rollNumber_key" ON "Student"("rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Student_departmentId_idx" ON "Student"("departmentId");

-- CreateIndex
CREATE INDEX "Student_isPending_idx" ON "Student"("isPending");

-- CreateIndex
CREATE INDEX "Student_optedIn_idx" ON "Student"("optedIn");

-- CreateIndex
CREATE UNIQUE INDEX "SemesterMark_studentId_semester_key" ON "SemesterMark"("studentId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAcademic_studentId_key" ON "StudentAcademic"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSkill_studentId_skillName_key" ON "StudentSkill"("studentId", "skillName");

-- CreateIndex
CREATE INDEX "StudentProject_studentId_idx" ON "StudentProject"("studentId");

-- CreateIndex
CREATE INDEX "StudentExperience_studentId_idx" ON "StudentExperience"("studentId");

-- CreateIndex
CREATE INDEX "StudentCertification_studentId_idx" ON "StudentCertification"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPreferences_studentId_key" ON "StudentPreferences"("studentId");

-- CreateIndex
CREATE INDEX "Drive_departmentId_idx" ON "Drive"("departmentId");

-- CreateIndex
CREATE INDEX "Drive_applicationDeadline_idx" ON "Drive"("applicationDeadline");

-- CreateIndex
CREATE INDEX "Drive_isCentralDrive_idx" ON "Drive"("isCentralDrive");

-- CreateIndex
CREATE INDEX "Drive_createdByUserId_idx" ON "Drive"("createdByUserId");

-- CreateIndex
CREATE INDEX "DriveDepartmentConfig_departmentId_idx" ON "DriveDepartmentConfig"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveDepartmentConfig_driveId_departmentId_key" ON "DriveDepartmentConfig"("driveId", "departmentId");

-- CreateIndex
CREATE INDEX "DriveApplication_driveId_idx" ON "DriveApplication"("driveId");

-- CreateIndex
CREATE INDEX "DriveApplication_stage_idx" ON "DriveApplication"("stage");

-- CreateIndex
CREATE INDEX "DriveApplication_status_idx" ON "DriveApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DriveApplication_studentId_driveId_key" ON "DriveApplication"("studentId", "driveId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccessRequest_userId_key" ON "StudentAccessRequest"("userId");

-- CreateIndex
CREATE INDEX "StudentAccessRequest_status_idx" ON "StudentAccessRequest"("status");

-- CreateIndex
CREATE INDEX "StudentAccessRequest_departmentId_status_idx" ON "StudentAccessRequest"("departmentId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterMark" ADD CONSTRAINT "SemesterMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAcademic" ADD CONSTRAINT "StudentAcademic_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProject" ADD CONSTRAINT "StudentProject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExperience" ADD CONSTRAINT "StudentExperience_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCertification" ADD CONSTRAINT "StudentCertification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPreferences" ADD CONSTRAINT "StudentPreferences_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveDepartmentConfig" ADD CONSTRAINT "DriveDepartmentConfig_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveDepartmentConfig" ADD CONSTRAINT "DriveDepartmentConfig_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveApplication" ADD CONSTRAINT "DriveApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveApplication" ADD CONSTRAINT "DriveApplication_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveApplication" ADD CONSTRAINT "DriveApplication_stageUpdatedById_fkey" FOREIGN KEY ("stageUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccessRequest" ADD CONSTRAINT "StudentAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccessRequest" ADD CONSTRAINT "StudentAccessRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccessRequest" ADD CONSTRAINT "StudentAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

