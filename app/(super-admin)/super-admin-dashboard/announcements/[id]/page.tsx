import { notFound, redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { getAnnouncement } from "@/features/announcements/queries/get-announcements";
import { AnnouncementDetail } from "@/features/announcements/components/announcement-detail";

export const dynamic = "force-dynamic";

/** One announcement, if this user is in its audience. */
export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch {
    redirect("/sign-in");
  }

  const { id } = await params;
  const announcement = await getAnnouncement(user, id);
  // Not targeted at them and not theirs to manage reads the same as missing.
  if (!announcement) notFound();

  return <AnnouncementDetail announcement={announcement} backHref="/super-admin-dashboard/announcements" />;
}
