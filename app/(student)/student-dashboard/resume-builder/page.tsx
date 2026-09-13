import { FileText } from 'lucide-react';
import ComingSoon from '@/components/shared/coming-soon';

export const metadata = { title: 'Resume Builder — CampusHire' };

export default function ResumeBuilderPage() {
  return (
    <ComingSoon
      icon={FileText}
      title="Resume Builder"
      description="Generate a placement-ready resume from the profile you have already filled in, and export it as a PDF."
      bullets={[
        'Pulls your academics, skills, projects and experience straight from your profile',
        'Campus-standard templates approved by the placement cell',
        'Download as PDF and attach to applications',
      ]}
    />
  );
}
