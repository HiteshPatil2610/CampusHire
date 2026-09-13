import { Gauge } from 'lucide-react';
import ComingSoon from '@/components/shared/coming-soon';

export const metadata = { title: 'Readiness — CampusHire' };

export default function ReadinessPage() {
  return (
    <ComingSoon
      icon={Gauge}
      title="Placement Readiness"
      description="A single score covering your academics, profile depth, assessment results and resume quality, tracked over time."
      bullets={[
        'Readiness score broken down by contributing factor',
        'Trend across semesters as you complete assessments',
        'Benchmarked against the drives you want to clear',
      ]}
    />
  );
}
