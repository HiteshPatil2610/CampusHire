import { requireSuperAdmin } from "@/lib/auth";
import { getNotificationDispatches } from "@/features/notifications/queries/get-notification-dispatches";
import { DispatchTable } from "@/features/notifications/components/dispatch-table";

export const dynamic = "force-dynamic";

/**
 * Whether the notifications an event should have produced were actually
 * written, and a way to re-send the ones that were not.
 */
export default async function NotificationDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireSuperAdmin();

  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status.toUpperCase() : undefined;
  const { rows, failed } = await getNotificationDispatches({ status });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Notification deliveries
        </h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Every fan-out CampusHire ran — a drive published, a cancellation, an
          announcement — and how many people it notified. Notifications are
          in-app only; nothing is emailed.
          {failed > 0 && ` ${failed} delivery${failed === 1 ? "" : "s"} failed and can be re-sent.`}
        </p>
      </div>

      <DispatchTable rows={rows} />
    </div>
  );
}
