/**
 * Profile Client Component
 * 
 * Main client-side component for the student profile page
 * Handles tab navigation and renders tab content based on active tab
 */

"use client";

import * as React from "react";
import type { CompleteProfile } from "@/features/students/queries/get-complete-profile";
import { ProfileHeader } from "./profile-header";
import { PersonalInfoTab } from "./personal-info-tab";
import { AcademicInfoTab } from "./academic-info-tab";

const TABS = [
  'Personal Info',
  'Academic Info',
  'Skills & Links',
  'Projects',
  'Internships & Experience',
  'Certifications',
  'Preferences',
] as const;

type TabName = typeof TABS[number];

export interface ProfileClientProps {
  student: CompleteProfile;
  profileCompletion: number;
}

/**
 * ProfileClient - Main profile interface with tab navigation
 * 
 * Client component that manages tab state and renders appropriate tab content
 */
export function ProfileClient({ student, profileCompletion }: ProfileClientProps) {
  const [activeTab, setActiveTab] = React.useState<TabName>('Personal Info');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Title */}
      <h1 className="text-3xl font-bold text-text-primary mb-6">
        Student Profile
      </h1>

      {/* Profile Header with completion and quick info */}
      <ProfileHeader 
        student={student} 
        profileCompletion={profileCompletion}
      />

      {/* Profile Layout: Sidebar Tabs + Content */}
      <div className="mt-6 flex gap-6">
        {/* Vertical Tab Navigation (Sticky Sidebar) */}
        <div className="w-56 flex-shrink-0">
          <div className="sticky top-6 space-y-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              const isDisabled = 
                tab !== 'Personal Info' && 
                tab !== 'Academic Info'; // Only these two tabs are implemented in Feature 2

              return (
                <button
                  key={tab}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setActiveTab(tab)}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all
                    ${isActive 
                      ? 'bg-accent text-white shadow-sm' 
                      : isDisabled
                        ? 'text-text-muted cursor-not-allowed opacity-50'
                        : 'text-text-secondary hover:bg-surface-1 hover:text-text-primary'
                    }
                  `}
                >
                  {tab}
                  {isDisabled && (
                    <span className="ml-2 text-xs opacity-70">(Coming soon)</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1">
          <div className="bg-surface-2 border border-border rounded-lg shadow-sm p-6 min-h-[600px]">
            {activeTab === 'Personal Info' && (
              <PersonalInfoTab student={student} />
            )}

            {activeTab === 'Academic Info' && (
              <AcademicInfoTab student={student} />
            )}

            {activeTab === 'Skills & Links' && (
              <div className="text-center py-12 text-text-muted">
                <p className="text-lg mb-2">🚧 Coming Soon</p>
                <p className="text-sm">Skills & Links tab will be available in Feature 3</p>
              </div>
            )}

            {activeTab === 'Projects' && (
              <div className="text-center py-12 text-text-muted">
                <p className="text-lg mb-2">🚧 Coming Soon</p>
                <p className="text-sm">Projects tab will be available in Feature 4</p>
              </div>
            )}

            {activeTab === 'Internships & Experience' && (
              <div className="text-center py-12 text-text-muted">
                <p className="text-lg mb-2">🚧 Coming Soon</p>
                <p className="text-sm">Experience tab will be available in Feature 5</p>
              </div>
            )}

            {activeTab === 'Certifications' && (
              <div className="text-center py-12 text-text-muted">
                <p className="text-lg mb-2">🚧 Coming Soon</p>
                <p className="text-sm">Certifications tab will be available in Feature 5</p>
              </div>
            )}

            {activeTab === 'Preferences' && (
              <div className="text-center py-12 text-text-muted">
                <p className="text-lg mb-2">🚧 Coming Soon</p>
                <p className="text-sm">Preferences tab will be available in Feature 6</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
