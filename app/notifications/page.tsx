import { NotificationList } from "@/components/notifications/NotificationList";
import { getNotifications } from "@/features/notifications/queries/get-notifications";
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  // Authorization: Any authenticated user
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    // Redirect to sign-in if not authenticated
    redirect("/sign-in");
  }

  // Fetch initial notifications for the authenticated user
  const notifications = await getNotifications(user.id, {
    page: 1,
    pageSize: 25,
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Notifications
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Stay updated with important activities and system updates
        </p>
      </div>

      <NotificationList initialNotifications={notifications} />
    </div>
  );
}
