import Link from "next/link";

/**
 * The state shown when the server refuses a screen: the person is signed in,
 * but this record is not theirs to see. Deliberately plain — it says what
 * happened and where to go, and reveals nothing about the record.
 */
export function PermissionDenied({
  message = "You do not have permission to view this.",
  backHref,
  backLabel = "Go back",
}: {
  message?: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div
      className="card"
      role="alert"
      style={{ textAlign: "center", padding: 40, maxWidth: 480, margin: "40px auto" }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }} aria-hidden>
        🔒
      </div>
      <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>Not available</h2>
      <p className="text-muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
        {message}
      </p>
      <Link href={backHref} className="btn btn-outline">
        {backLabel}
      </Link>
    </div>
  );
}
