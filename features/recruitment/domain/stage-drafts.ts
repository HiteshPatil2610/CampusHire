import type { RecruitmentStageType } from "./pipeline";

/** A stage being edited. Dates travel as datetime-local strings. */
export interface StageDraft {
  key: string;
  name: string;
  stageType: RecruitmentStageType;
  description: string;
  instructions: string;
  visibleToStudents: boolean;
  scheduledAt: string;
  location: string;
  isEnabled: boolean;
}

let counter = 0;
// Drafts are built on the server (page props) and in the browser (added
// stages); a random suffix keeps the two counters from ever colliding.
const nextKey = () => `stage-${++counter}-${Math.random().toString(36).slice(2, 8)}`;

const toLocalInput = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function newStageKey(): string {
  return nextKey();
}

export function toStageDrafts(
  stages: {
    name: string;
    stageType: RecruitmentStageType;
    description?: string | null;
    instructions?: string | null;
    visibleToStudents?: boolean;
    scheduledAt?: Date | string | null;
    location?: string | null;
    isEnabled?: boolean;
  }[]
): StageDraft[] {
  return stages.map((stage) => ({
    key: nextKey(),
    name: stage.name,
    stageType: stage.stageType,
    description: stage.description ?? "",
    instructions: stage.instructions ?? "",
    visibleToStudents: stage.visibleToStudents ?? true,
    scheduledAt: toLocalInput(stage.scheduledAt),
    location: stage.location ?? "",
    isEnabled: stage.isEnabled ?? true,
  }));
}

/** Drafts as the server receives them. */
export function fromStageDrafts(drafts: StageDraft[]) {
  return drafts.map((draft) => ({
    name: draft.name,
    stageType: draft.stageType,
    description: draft.description || null,
    instructions: draft.instructions || null,
    visibleToStudents: draft.visibleToStudents,
    scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
    location: draft.location || null,
    isEnabled: draft.isEnabled,
  }));
}
