-- Self-registration now goes through an admin approval queue unless the
-- sign-up matches a student the admin already imported.

CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Self-asserted, unverified details. Deliberately NOT written into "Student"
-- until an admin approves, so an unapproved sign-up never appears in a
-- roster, in totalStudents, or in the placement-rate denominator.
CREATE TABLE "StudentAccessRequest" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "rollNumber"   TEXT,
    "departmentId" TEXT NOT NULL,
    "phoneNumber"  TEXT NOT NULL,
    "entryType"    "EntryType" NOT NULL DEFAULT 'REGULAR',
    "status"       "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt"   TIMESTAMP(3),
    "reviewNote"   TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAccessRequest_pkey" PRIMARY KEY ("id")
);

-- One open request per person.
CREATE UNIQUE INDEX "StudentAccessRequest_userId_key" ON "StudentAccessRequest"("userId");
CREATE INDEX "StudentAccessRequest_status_idx" ON "StudentAccessRequest"("status");
CREATE INDEX "StudentAccessRequest_departmentId_idx" ON "StudentAccessRequest"("departmentId");
-- The department admin's queue query filters on both.
CREATE INDEX "StudentAccessRequest_departmentId_status_idx" ON "StudentAccessRequest"("departmentId", "status");

ALTER TABLE "StudentAccessRequest"
  ADD CONSTRAINT "StudentAccessRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAccessRequest"
  ADD CONSTRAINT "StudentAccessRequest_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentAccessRequest"
  ADD CONSTRAINT "StudentAccessRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
