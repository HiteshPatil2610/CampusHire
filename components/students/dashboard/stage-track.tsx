import { Fragment } from 'react';
import type { ApplicationStage } from '@prisma/client';

/** Ordered selection stages shown on every applied drive card. */
export const STAGE_ORDER: ApplicationStage[] = [
  'APPLIED',
  'APTITUDE',
  'INTERVIEW',
  'OFFER',
];

const STAGE_LABELS: Record<ApplicationStage, string> = {
  APPLIED: 'Applied',
  APTITUDE: 'Aptitude',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
};

export interface StageTrackProps {
  /** Stage the application has reached, or null when not applied yet. */
  stage: ApplicationStage | null;
  /** Labels shown when the student has not applied (Apply / Online Test / …). */
  pendingLabels?: string[];
}

/**
 * Four-step selection tracker. Steps before the current one render as done,
 * the current one is highlighted, and the rest stay numbered and inactive.
 * With no application, step 1 is the highlighted call to action.
 */
export default function StageTrack({ stage, pendingLabels }: StageTrackProps) {
  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : 0;
  const labels =
    pendingLabels && !stage
      ? pendingLabels
      : STAGE_ORDER.map((value) => STAGE_LABELS[value]);

  return (
    <div className="stage-track">
      {STAGE_ORDER.map((value, index) => {
        const isDone = Boolean(stage) && index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <Fragment key={value}>
            {index > 0 && (
              <span
                className={`stage-connector ${isDone || (stage && index <= currentIndex) ? 'done' : ''}`.trim()}
                aria-hidden
              />
            )}
            <div className={`stage-step ${isCurrent ? 'is-current' : ''}`.trim()}>
              <span
                className={`stage-circle ${
                  isDone ? 'done' : isCurrent ? 'current' : ''
                }`.trim()}
              >
                {isDone ? '✓' : index + 1}
              </span>
              <span className="stage-label">{labels[index]}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
