-- Academic record rules (profile logic fixes).
--
-- 1. A student with no completed semester yet (semester 1, or a lateral-entry
--    student in semester 3) has no CGPA, so "currentCGPA" may now be empty.
--    Dropping NOT NULL changes no existing row: every stored CGPA stays.
-- 2. Boards grade the 10th / 12th / diploma either as a percentage or as a
--    CGPA. The percentage column stays what eligibility compares; a new
--    nullable column per record keeps the CGPA the student entered when their
--    board gave one. Existing rows read as "entered as a percentage".
--
-- Additive only: no column or row is removed or rewritten.

ALTER TABLE "StudentAcademic" ALTER COLUMN "currentCGPA" DROP NOT NULL;

ALTER TABLE "StudentAcademic" ADD COLUMN "tenthCgpa" DOUBLE PRECISION;
ALTER TABLE "StudentAcademic" ADD COLUMN "twelfthCgpa" DOUBLE PRECISION;
ALTER TABLE "StudentAcademic" ADD COLUMN "diplomaCgpa" DOUBLE PRECISION;
