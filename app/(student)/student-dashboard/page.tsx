import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrCreateUser } from "@/lib/auth";
import { getStudentProfileByUserId } from "@/features/students/queries/get-profile";
import { calculateProfileCompletion } from "@/features/students/queries/profile-completion";
import { RegistrationForm } from "@/components/students/RegistrationForm";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  // Get authenticated user
  const user = await getOrCreateUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  // Check if student profile exists
  const profile = await getStudentProfileByUserId(user.id);

  // If no student profile, show registration form
  if (!profile) {
    return <RegistrationForm />;
  }

  // Calculate profile completion
  const completion = calculateProfileCompletion(profile);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
          Welcome back, {profile.student.name}!
        </h1>
        <p className="text-[var(--text-secondary)]">
          {profile.student.department.name} • Roll No. {profile.student.rollNumber}
        </p>
      </div>

      {/* Profile Completion Card */}
      <div className="bg-[var(--surface-2)] rounded-xl border border-[var(--border)] p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              Profile Completion
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Complete your profile to become eligible for placement drives
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[var(--accent)] mb-1">
              {completion.percentage}%
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {completion.requiredFieldsFilled} of {completion.totalRequiredFields} fields
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[var(--surface-1)] rounded-full h-2 mb-4">
          <div
            className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>

        {/* Section Status */}
        {completion.percentage < 100 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
              Incomplete Sections:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {!completion.sectionsStatus.academic && (
                <div className="text-sm text-[var(--text-secondary)]">• Academic Information</div>
              )}
              {!completion.sectionsStatus.skills && (
                <div className="text-sm text-[var(--text-secondary)]">• Skills</div>
              )}
              {!completion.sectionsStatus.projects && (
                <div className="text-sm text-[var(--text-secondary)]">• Projects</div>
              )}
              {!completion.sectionsStatus.experience && (
                <div className="text-sm text-[var(--text-secondary)]">• Experience</div>
              )}
              {!completion.sectionsStatus.certifications && (
                <div className="text-sm text-[var(--text-secondary)]">• Certifications</div>
              )}
              {!completion.sectionsStatus.preferences && (
                <div className="text-sm text-[var(--text-secondary)]">• Preferences</div>
              )}
            </div>
          </div>
        )}

        {completion.percentage === 100 && (
          <div className="flex items-center gap-2 text-[var(--teal)] text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Your profile is complete!</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link
          href="/student-dashboard/profile"
          className="bg-[var(--surface-2)] rounded-xl border border-[var(--border)] p-6 hover:border-[var(--accent)] transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                Complete Profile
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Add your skills, projects, and experience
              </p>
            </div>
            <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--border)] p-6 opacity-60">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                View Drives
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Browse and apply to placement drives
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Coming in next unit
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Summary */}
      <div className="bg-[var(--surface-2)] rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Profile Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {profile.skills.length}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">Skills</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {profile.projects.length}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">Projects</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {profile.experiences.length}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">Experience</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--accent)]">
              {profile.certifications.length}
            </div>
            <div className="text-sm text-[var(--text-secondary)]">Certifications</div>
          </div>
        </div>
      </div>
    </div>
  );
}
