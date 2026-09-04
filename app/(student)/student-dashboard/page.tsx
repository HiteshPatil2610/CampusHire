import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();
  
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
        Welcome to Student Dashboard
      </h1>
      <div className="mt-6 p-6 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
        <p className="text-[var(--text-secondary)] mb-4">
          ✅ You are successfully signed in!
        </p>
        <div className="space-y-2">
          <p className="text-[var(--text-primary)]">
            <strong>Name:</strong> {user?.firstName} {user?.lastName}
          </p>
          <p className="text-[var(--text-primary)]">
            <strong>Email:</strong> {user?.emailAddresses[0]?.emailAddress}
          </p>
          <p className="text-[var(--text-primary)]">
            <strong>User ID:</strong> {userId}
          </p>
        </div>
      </div>
      <p className="mt-6 text-[var(--text-secondary)]">
        Student dashboard features will be implemented in future units
      </p>
    </div>
  );
}
