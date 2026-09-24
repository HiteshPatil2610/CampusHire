import { requireSuperAdmin } from "@/lib/auth";
import { getPendingSkills } from "@/features/skills/queries/get-pending-skills";
import { SkillsReviewClient } from "./skills-review-client";

export const dynamic = "force-dynamic";

/**
 * The master skill list's review queue (Item 3). A name a student typed that
 * matched nothing already shows on their profile, tagged pending — nothing
 * here gates that. What is decided here is only whether it joins the shared
 * list every other student's autocomplete offers.
 */
export default async function SkillsReviewPage() {
  await requireSuperAdmin();
  const pending = await getPendingSkills();

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Skill Review</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Skills students typed that matched nothing on the master list. Approving one lists
          it for every student&apos;s autocomplete from now on. Rejecting one removes it — and
          it disappears from every profile that had added it.
        </p>
      </div>
      <SkillsReviewClient pending={pending} />
    </div>
  );
}
