import { PencilLine } from 'lucide-react';
import ComingSoon from '@/components/shared/coming-soon';

export const metadata = { title: 'Self Assessment — CampusHire' };

export default function SelfAssessmentPage() {
  return (
    <ComingSoon
      icon={PencilLine}
      title="Self Assessment"
      description="Practice aptitude and technical rounds under timed conditions before the real drive."
      bullets={[
        'Aptitude, verbal and technical question sets',
        'Timed mock rounds that mirror the campus test pattern',
        'Results feed into your readiness score',
      ]}
    />
  );
}
