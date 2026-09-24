'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import UrlField from '@/components/ui/url-field';
import SkillPicker, { type SkillTag } from './skill-picker';
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

/** A legacy row with no master entry is treated as already-approved. */
function toSkillTags(profile: CompleteProfile, type: 'TECHNICAL' | 'SOFT'): SkillTag[] {
  return profile.skills
    .filter((skill) => skill.skillType === type)
    .map((skill) => ({ name: skill.skillName, pending: skill.skill?.status === 'PENDING' }));
}

export default function TabSkillsLinks({ profile }: TabSkillsLinksProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [technicalSkills, setTechnicalSkills] = useState<SkillTag[]>(() => toSkillTags(profile, 'TECHNICAL'));
  const [softSkills, setSoftSkills] = useState<SkillTag[]>(() => toSkillTags(profile, 'SOFT'));
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
        // GitHub is optional everywhere (Item 2) — an empty value is simply
        // not sent, same as LinkedIn and Portfolio above and below.
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

      const existingTechnical = profile.skills.filter((skill) => skill.skillType === 'TECHNICAL');
      const existingSoft = profile.skills.filter((skill) => skill.skillType === 'SOFT');

      for (const skill of existingTechnical) {
        if (!technicalSkills.some((tag) => tag.name === skill.skillName)) {
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
        if (!softSkills.some((tag) => tag.name === skill.skillName)) {
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

      for (const tag of technicalSkills) {
        if (!existingTechnical.some((skill) => skill.skillName === tag.name)) {
          const result = await addSkill({ skillName: tag.name, skillType: 'TECHNICAL' });
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

      for (const tag of softSkills) {
        if (!existingSoft.some((skill) => skill.skillName === tag.name)) {
          const result = await addSkill({ skillName: tag.name, skillType: 'SOFT' });
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
        <SkillPicker
          skillType="TECHNICAL"
          value={technicalSkills}
          onChange={setTechnicalSkills}
          placeholder="e.g. Python, React, Docker…"
          disabled={isPending}
        />
      </div>

      <div className="field" style={{ marginBottom: 24 }}>
        <label>Soft Skills</label>
        <SkillPicker
          skillType="SOFT"
          value={softSkills}
          onChange={setSoftSkills}
          placeholder="e.g. Communication, Teamwork…"
          disabled={isPending}
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
          <label>GitHub (optional)</label>
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
