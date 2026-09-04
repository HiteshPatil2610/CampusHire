import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  // If authenticated, show a welcome message with a link to dashboard
  if (userId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-semibold text-[var(--text-primary)]">
            Welcome to CampusHire
          </h1>
          <p className="mt-4 text-[var(--text-secondary)]">
            You are successfully signed in!
          </p>
          <div className="mt-8">
            <Link
              href="/student-dashboard"
              className="inline-block px-8 py-3 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-dark)] transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, show sign-in/sign-up options
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-[var(--text-primary)]">
          CampusHire
        </h1>
        <p className="mt-4 text-[var(--text-secondary)]">
          Campus Placement Management Platform
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/sign-in"
            className="px-6 py-2 bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-dark)] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-6 py-2 border border-[var(--border-strong)] text-[var(--text-primary)] rounded-md hover:bg-[var(--surface-1)] transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
