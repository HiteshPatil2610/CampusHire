import { redirect } from "next/navigation";

/**
 * The applications list is now the Applications tab of the drive's workspace.
 * This route stays so existing links and bookmarks keep working.
 */
export default async function DriveApplicationsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page } = await searchParams;
  const query = new URLSearchParams({ tab: "applications" });
  if (page && /^\d+$/.test(page)) query.set("page", page);
  redirect(`/admin-dashboard/drives/${id}?${query.toString()}`);
}
