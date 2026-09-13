import Link from 'next/link';

export default function IneligibleDrivePage() {
  return (
    <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
      <h1 className="page-title" style={{ marginBottom: 8 }}>
        You are not eligible for this drive
      </h1>
      <p className="text-secondary" style={{ marginBottom: 20, fontSize: 14 }}>
        This drive is outside your eligibility criteria, closed, or no longer
        available to you.
      </p>
      <Link href="/student-dashboard/drives" className="btn btn-primary">
        Back to drives
      </Link>
    </div>
  );
}
