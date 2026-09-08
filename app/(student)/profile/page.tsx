/**
 * Student Profile Page (Server Component)
 * 
 * Fetches complete profile data from the database and passes it to the client component
 * Uses Next.js App Router with Server Components for optimal performance
 */

import { redirect } from "next/navigation";
import { getCurrentStudent } from "@/lib/auth-helpers";
import { calculateProfileCompletion } from "@/features/students/queries/get-complete-profile";
import { ProfileClient } from "./profile-client";

export const metadata = {
  title: "Student Profile | CampusHire",
  description: "Manage your student profile information",
};

/**
 * Profile Page - Server Component
 * 
 * Fetches authenticated student data and renders the profile interface
 */
export default async function ProfilePage() {
  try {
    // Fetch complete student profile with all relations
    const student = await getCurrentStudent();

    // Calculate profile completion percentage
    const profileCompletion = calculateProfileCompletion(student);

    // Pass data to client component
    return (
      <ProfileClient 
        student={student} 
        profileCompletion={profileCompletion}
      />
    );
  } catch (error) {
    // If authentication fails or student not found, redirect to sign-in
    if (error instanceof Error) {
      if (
        error.message === "Unauthorized: No authenticated user" ||
        error.message === "Student profile not found for authenticated user"
      ) {
        redirect("/sign-in");
      }
    }

    // For other errors, re-throw to be caught by error boundary
    throw error;
  }
}
