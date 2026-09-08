'use client';

import { useState } from 'react';
import ProfileHeaderStrip from './profile-header-strip';
import TabPersonalInfo from './tab-personal-info';
import TabAcademicInfo from './tab-academic-info';
import TabSkillsLinks from './tab-skills-links';
import TabProjects from './tab-projects';
import TabExperience from './tab-experience';
import TabCertifications from './tab-certifications';
import TabPreferences from './tab-preferences';
import type {
  CompleteProfile,
  ProfileCompletion,
} from '@/features/students/queries/profile-completion';

const TABS = [
  'Personal Info',
  'Academic Info',
  'Skills & Links',
  'Projects',
  'Internships & Experience',
  'Certifications',
  'Preferences',
] as const;

type TabName = (typeof TABS)[number];

export interface StudentProfileClientProps {
  profile: CompleteProfile;
  completion: ProfileCompletion;
}

export default function StudentProfileClient({
  profile,
  completion,
}: StudentProfileClientProps) {
  const [activeTab, setActiveTab] = useState<TabName>('Personal Info');

  function renderTab() {
    switch (activeTab) {
      case 'Personal Info':
        return <TabPersonalInfo profile={profile} />;
      case 'Academic Info':
        return <TabAcademicInfo profile={profile} />;
      case 'Skills & Links':
        return <TabSkillsLinks profile={profile} />;
      case 'Projects':
        return <TabProjects profile={profile} />;
      case 'Internships & Experience':
        return <TabExperience profile={profile} />;
      case 'Certifications':
        return <TabCertifications profile={profile} />;
      case 'Preferences':
        return <TabPreferences profile={profile} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Student Profile
      </h1>

      <ProfileHeaderStrip profile={profile} completion={completion} />

      <div className="profile-layout">
        <nav className="profile-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="card">{renderTab()}</div>
      </div>
    </div>
  );
}
