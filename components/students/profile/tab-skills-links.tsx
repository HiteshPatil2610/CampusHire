'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import TagInput from '@/components/ui/tag-input';
import UrlField from '@/components/ui/url-field';
import { useToast } from '@/hooks/use-toast';
import { updatePersonalInfo } from '@/features/students/actions/profile-personal';
import { addSkill, removeSkill } from '@/features/students/actions/profile-skills';
import type { CompleteProfile } from '@/features/students/queries/profile-completion';

export interface TabSkillsLinksProps {
  profile: CompleteProfile;
}

function stripUrlPrefix(url: string | null | undefined, host: string): string {
  if (!url) return '';
  return url
    .replace(/^https?:\/\//i, '')
    .replace(new RegExp(`^${host}`, 'i'), '');
}

export default function TabSkillsLinks({ profile }: TabSkillsLinksProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [technicalSkills, setTechnicalSkills] = useState<string[]>(
    profile.skills
      .filter((skill) => skill.skillType === 'TECHNICAL')
      .map((skill) => skill.skillName)
  );
  const [softSkills, setSoftSkills] = useState<string[]>(
    profile.skills
      .filter((skill) => skill.skillType === 'SOFT')
      .map((skill) => skill.skillName)
  );
  const [links, setLinks] = useState({
    linkedinUrl: stripUrlPrefix(profile.student.linkedinUrl, 'linkedin.com/in/'),
    githubUrl: stripUrlPrefix(profile.student.githubUrl, 'github.com/'),
    portfolioUrl: profile.student.portfolioUrl ?? '',
  });

  function handleSave() {
    startTransition(async () => {
      const linkResult = await updatePersonalInfo({
        name: profile.student.name,
        linkedinUrl: links.linkedinUrl
          ? `https://linkedin.com/in/${links.linkedinUrl.replace(/^\/+/, '')}`
          : undefined,
        githubUrl: links.githubUrl
          ? `https://github.com/${links.githubUrl.replace(/^\/+/, '')}`
          : undefined,
        portfolioUrl: links.portfolioUrl || undefined,
      });

      if (!linkResult.success) {
        toast({
          title: 'Error',
          description: linkResult.error ?? 'Failed to save links.',
          variant: 'destructive',
        });
        return;
      }

      const existingTechnical = profile.skills.filter(
        (skill) => skill.skillType === 'TECHNICAL'
      );
      const existingSoft = profile.skills.filter(
        (skill) => skill.skillType === 'SOFT'
      );

      for (const skill of existingTechnical) {
        if (!technicalSkills.includes(skill.skillName)) {
          const result = await removeSkill(skill.id);
          if (!result.success) {
            toast({
              title: 'Error',
              description: result.error ?? 'Failed to update skills.',
              variant: 'destructive',
            });
            return;
          }
        }
      }

      for (const skill of existingSoft) {
        if (!softSkills.includes(skill.skillName)) {
          const result = await removeSkill(skill.id);
          if (!result.success) {
            toast({
              title: 'Error',
              description: result.error ?? 'Failed to update skills.',
              variant: 'destructive',
            });
            return;
          }
        }
      }

      for (const skillName of technicalSkills) {
        if (!existingTechnical.some((skill) => skill.skillName === skillName)) {
          const result = await addSkill({ skillName, skillType: 'TECHNICAL' });
          if (!result.success) {
            toast({
              title: 'Error',
              description: result.error ?? 'Failed to add skill.',
              variant: 'destructive',
            });
            return;
          }
        }
      }

      for (const skillName of softSkills) {
        if (!existingSoft.some((skill) => skill.skillName === skillName)) {
          const result = await addSkill({ skillName, skillType: 'SOFT' });
          if (!result.success) {
            toast({
              title: 'Error',
              description: result.error ?? 'Failed to add skill.',
              variant: 'destructive',
            });
            return;
          }
        }
      }

      toast({ title: 'Saved', description: 'Skills and links updated.' });
      router.refresh();
    });
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Skills & Web Presence
      </h3>

      <div className="field" style={{ marginBottom: 20 }}>
        <label>Technical Skills</label>
        <TagInput
          value={technicalSkills}
          onChange={setTechnicalSkills}
          placeholder="e.g. Python, React, Docker…"
        />
      </div>

      <div className="field" style={{ marginBottom: 24 }}>
        <label>Soft Skills</label>
        <TagInput
          value={softSkills}
          onChange={setSoftSkills}
          placeholder="e.g. Communication, Teamwork…"
        />
      </div>

      <div className="card" style={{ background: 'var(--surface-1)', marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 13 }}>
          Professional Profiles
        </h4>
        <div className="field">
          <label>LinkedIn</label>
          <UrlField
            platform="linkedin"
            value={links.linkedinUrl}
            onChange={(value) =>
              setLinks({ ...links, linkedinUrl: value })
            }
            placeholder="username"
          />
        </div>
        <div className="field">
          <label>GitHub</label>
          <UrlField
            platform="github"
            value={links.githubUrl}
            onChange={(value) => setLinks({ ...links, githubUrl: value })}
            placeholder="username"
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Portfolio</label>
          <UrlField
            platform="portfolio"
            value={links.portfolioUrl}
            onChange={(value) =>
              setLinks({ ...links, portfolioUrl: value })
            }
            placeholder="yourportfolio.com"
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
