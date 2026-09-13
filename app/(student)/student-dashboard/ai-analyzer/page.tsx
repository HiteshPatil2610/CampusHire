import { Sparkles } from 'lucide-react';
import ComingSoon from '@/components/shared/coming-soon';

export const metadata = { title: 'AI Analyzer — CampusHire' };

export default function AiAnalyzerPage() {
  return (
    <ComingSoon
      icon={Sparkles}
      title="AI Analyzer"
      description="Get a scored review of your resume and profile, with specific suggestions for the drives you are targeting."
      bullets={[
        'Resume score with section-by-section feedback',
        'Skill gaps measured against the roles you are eligible for',
        'Suggested next steps before each drive deadline',
      ]}
    />
  );
}
