-- Item 3: the master skill list.
--
-- A shared catalogue of Technical and Soft skills (`Skill`), offered by
-- every student's autocomplete once APPROVED. A name a student types that
-- matches nothing existing creates a PENDING row immediately — their
-- profile shows it right away — for a Super Admin to approve (which lists
-- it for everyone) or reject (which deletes it and, by cascade, every
-- StudentSkill row that had picked it up). See the model comments in
-- schema.prisma for the full design.
--
-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterEnum: the Super Admin's notification when a student's typed skill has
-- no match on the master list (Item 3). Not used elsewhere in this file, so
-- it is safe inside this migration's own transaction.
ALTER TYPE "NotificationEvent" ADD VALUE 'SKILL_PENDING_REVIEW';

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "skillType" "SkillType" NOT NULL,
    "status" "SkillStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByStudentId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- AlterTable: the reference. Nullable — existing rows have none until the
-- backfill below runs, and a legacy row an admin later clears keeps none.
ALTER TABLE "StudentSkill" ADD COLUMN     "skillId" TEXT;

-- CreateIndex
CREATE INDEX "Skill_status_skillType_idx" ON "Skill"("status", "skillType");

-- CreateIndex: one entry per spelling-normalized name and type — the whole
-- moderation queue lives on this constraint (see schema.prisma).
CREATE UNIQUE INDEX "Skill_normalizedName_skillType_key" ON "Skill"("normalizedName", "skillType");

-- CreateIndex
CREATE INDEX "StudentSkill_skillId_idx" ON "StudentSkill"("skillId");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_requestedByStudentId_fkey" FOREIGN KEY ("requestedByStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: rejecting a skill (a delete, never a status) cascades to
-- every student who had picked it up — the removal the tracker asks for is
-- the database doing it, not a second write a reject action could forget.
ALTER TABLE "StudentSkill" ADD CONSTRAINT "StudentSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A name is never blank and never absurd. Short real names exist ("C", "Go",
-- "R"), so the floor is 1 character, not 2.
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_name_shape"
  CHECK (char_length(btrim("name")) BETWEEN 1 AND 60);

-- The lookup key is always what the app would compute from the name, never
-- something a write could let drift from it.
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_normalizedName_matches_name"
  CHECK ("normalizedName" = lower(btrim("name")));

-- PENDING carries no approval; APPROVED always has an approvedAt (the
-- approver is optional — see the backfill below, which grandfathers
-- existing names in with nobody named as the approver).
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_approval_consistent"
  CHECK (
    ("status" = 'PENDING' AND "approvedAt" IS NULL AND "approvedById" IS NULL)
    OR ("status" = 'APPROVED' AND "approvedAt" IS NOT NULL)
  );

-- Migration strategy for existing skill strings (Item 3): every StudentSkill
-- row written before this table existed is folded into one master Skill per
-- (name compared case/space-insensitively, type), marked APPROVED — these
-- names are already live on real profiles, not new submissions awaiting
-- review, so nothing here is held for the Super Admin to decide on. Nothing
-- on StudentSkill is deleted, renamed or touched beyond filling in skillId:
-- each student keeps the exact spelling they typed in skillName, even where
-- several spellings now share one Skill. The Skill's own display name is the
-- shortest, then alphabetically-first, spelling among them — deterministic,
-- so this needs no manual review, and is exactly what every future
-- autocomplete suggestion will show.
--
-- On this database today this is a no-op (no StudentSkill rows exist yet),
-- but it is written to be correct for any state, since a later environment
-- may carry real data through this same migration.
WITH grouped AS (
  SELECT
    lower(btrim("skillName")) AS normalized,
    "skillType",
    (array_agg("skillName" ORDER BY length(btrim("skillName")) ASC, "skillName" ASC))[1] AS display_name
  FROM "StudentSkill"
  WHERE btrim("skillName") <> ''
  GROUP BY lower(btrim("skillName")), "skillType"
),
inserted AS (
  INSERT INTO "Skill" (id, name, "normalizedName", "skillType", status, "approvedAt", "createdAt", "updatedAt")
  SELECT
    'skl_' || replace(gen_random_uuid()::text, '-', ''),
    btrim(display_name),
    normalized,
    "skillType",
    'APPROVED',
    now(),
    now(),
    now()
  FROM grouped
  RETURNING "id", "normalizedName", "skillType"
)
UPDATE "StudentSkill" ss
SET "skillId" = inserted."id"
FROM inserted
WHERE lower(btrim(ss."skillName")) = inserted."normalizedName"
  AND ss."skillType" = inserted."skillType";
