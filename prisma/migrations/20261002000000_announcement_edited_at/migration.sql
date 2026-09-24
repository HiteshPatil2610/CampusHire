-- PHASE 8: an announcement's "edited" timestamp (Item 19).
--
-- `updatedAt` already changes on publish and archive as well as on a content
-- edit, so it cannot tell "someone changed the text" from "the status
-- changed" — `editedAt` is set only by `saveAnnouncement` against an existing
-- row (application code), never by create, publish or archive. Nullable and
-- additive: every existing row reads as never-edited, which is correct.

ALTER TABLE "Announcement" ADD COLUMN "editedAt" TIMESTAMP(3);
