/**
 * Profile Header Component
 * 
 * Displays student profile summary with:
 * - Profile photo/avatar
 * - Name, roll number, department
 * - Profile completion progress bar
 */

"use client";

import * as React from "react";
import type { CompleteProfile } from "@/features/students/queries/get-complete-profile";

export interface ProfileHeaderProps {
  student: CompleteProfile;
  profileCompletion: number;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: Date | null | undefined): number | null {
  if (!dob) return null;
  
  const today = new Date();
  const birthDate = new Date(dob);
  
  if (isNaN(birthDate.getTime())) return null;
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get completion color based on percentage
 */
function getCompletionColor(percentage: number): string {
  if (percentage >= 80) return 'bg-teal';
  if (percentage >= 50) return 'bg-amber';
  return 'bg-red';
}

/**
 * ProfileHeader - Student profile summary card
 */
export function ProfileHeader({ student, profileCompletion }: ProfileHeaderProps) {
  const age = calculateAge(student.dateOfBirth);
  const initials = getInitials(student.name);
  const completionColor = getCompletionColor(profileCompletion);

  return (
    <div className="bg-surface-2 border border-border rounded-lg shadow-sm p-6">
      <div className="flex items-start gap-6">
        {/* Profile Photo / Avatar */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 rounded-full bg-accent-light border-2 border-accent/20 flex items-center justify-center overflow-hidden">
            {student.profilePhotoUrl ? (
              <img
                src={student.profilePhotoUrl}
                alt={student.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-accent-dark">
                {initials}
              </span>
            )}
          </div>
        </div>

        {/* Profile Information */}
        <div className="flex-1 min-w-0">
          {/* Name and Basic Info */}
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-text-primary mb-1">
              {student.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="font-medium">Roll No:</span>
                <span>{student.rollNumber}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="font-medium">Department:</span>
                <span>{student.department.name}</span>
              </span>
              {student.semester && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">Semester:</span>
                  <span>{student.semester}</span>
                </span>
              )}
              {age !== null && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">Age:</span>
                  <span>{age} years</span>
                </span>
              )}
            </div>
          </div>

          {/* Profile Completion Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary">
                Profile Completion
              </span>
              <span className="text-sm font-bold text-text-primary">
                {profileCompletion}%
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-surface-1 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full ${completionColor} transition-all duration-500 ease-out rounded-full`}
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            
            {/* Completion Message */}
            <p className="mt-2 text-xs text-text-secondary">
              {profileCompletion < 50 && (
                <>
                  ⚠️ Complete your profile to improve your chances of getting placed
                </>
              )}
              {profileCompletion >= 50 && profileCompletion < 80 && (
                <>
                  📈 Good progress! Add more details to strengthen your profile
                </>
              )}
              {profileCompletion >= 80 && profileCompletion < 100 && (
                <>
                  ✨ Almost there! Just a few more details to complete
                </>
              )}
              {profileCompletion === 100 && (
                <>
                  ✅ Excellent! Your profile is complete and ready for placements
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick Stats (Optional) */}
        {student.academic && (
          <div className="flex-shrink-0 hidden lg:flex flex-col gap-3">
            <div className="bg-surface-1 rounded-lg px-4 py-3 min-w-[140px]">
              <div className="text-xs text-text-secondary mb-1">Current CGPA</div>
              <div className="text-2xl font-bold text-accent">
                {student.academic.currentCGPA.toFixed(2)}
              </div>
            </div>
            {student.academic.activeBacklogs !== undefined && (
              <div className="bg-surface-1 rounded-lg px-4 py-3 min-w-[140px]">
                <div className="text-xs text-text-secondary mb-1">Active Backlogs</div>
                <div className={`text-2xl font-bold ${student.academic.activeBacklogs === 0 ? 'text-teal' : 'text-red'}`}>
                  {student.academic.activeBacklogs}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
