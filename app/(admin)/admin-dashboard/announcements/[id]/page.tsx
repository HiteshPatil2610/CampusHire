import { notFound, redirect } from "next/navigation";
import { requireDepartmentAdmin } from "@/lib/auth";
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
    ({ user } = await requireDepartmentAdmin());
  } catch {
    redirect("/sign-in");
  }

  const { id } = await params;
  const announcement = await getAnnouncement(user, id);
  // Not targeted at them and not theirs to manage reads the same as missing.
  if (!announcement) notFound();

  return <AnnouncementDetail announcement={announcement} backHref="/admin-dashboard/announcements" />;
}
