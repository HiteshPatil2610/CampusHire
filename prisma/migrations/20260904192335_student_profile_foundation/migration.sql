-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'DEPT_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('TECHNICAL', 'SOFT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
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
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAcademic" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tenthPercentage" DOUBLE PRECISION NOT NULL,
    "twelfthPercentage" DOUBLE PRECISION NOT NULL,
    "currentCGPA" DOUBLE PRECISION NOT NULL,
    "currentSemester" INTEGER NOT NULL,
    "activeBacklogs" INTEGER NOT NULL DEFAULT 0,
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
    "expectedPackageMin" DOUBLE PRECISION,
    "expectedPackageMax" DOUBLE PRECISION,
    "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_code_idx" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentAdmin_userId_key" ON "DepartmentAdmin"("userId");

-- CreateIndex
CREATE INDEX "DepartmentAdmin_departmentId_idx" ON "DepartmentAdmin"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_rollNumber_key" ON "Student"("rollNumber");

-- CreateIndex
CREATE INDEX "Student_userId_idx" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_departmentId_idx" ON "Student"("departmentId");

-- CreateIndex
CREATE INDEX "Student_rollNumber_idx" ON "Student"("rollNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAcademic_studentId_key" ON "StudentAcademic"("studentId");

-- CreateIndex
CREATE INDEX "StudentAcademic_studentId_idx" ON "StudentAcademic"("studentId");

-- CreateIndex
CREATE INDEX "StudentSkill_studentId_idx" ON "StudentSkill"("studentId");

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
CREATE INDEX "StudentPreferences_studentId_idx" ON "StudentPreferences"("studentId");

-- AddForeignKey
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentAdmin" ADD CONSTRAINT "DepartmentAdmin_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
