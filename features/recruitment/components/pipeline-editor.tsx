"use client";

import { useMemo, useState } from "react";
import {
  STAGE_TYPES,
  STAGE_TYPE_LABELS,
  validatePipelineStages,
  type RecruitmentStageType,
} from "../domain/pipeline";

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
const nextKey = () => `stage-${++counter}`;

const toLocalInput = (value: Date | string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

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

/**
 * Edit a pipeline: stages in order, each with a type, name, visibility,
 * schedule and instructions. Application stays first and Offer last; the
 * rounds between are free. Checked live with the server's own validator —
 * which the server runs again, since nothing here is trusted.
 */
export function PipelineEditor({
  drafts,
  onChange,
}: {
  drafts: StageDraft[];
  onChange: (drafts: StageDraft[]) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const validation = useMemo(() => validatePipelineStages(fromStageDrafts(drafts)), [drafts]);

  const update = (key: string, patch: Partial<StageDraft>) =>
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    // The bookends stay put: nothing moves above Application or below Offer.
    if (target <= 0 || target >= drafts.length - 1) return;
    const next = [...drafts];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addStage = () => {
    const stage: StageDraft = {
      key: nextKey(),
      name: "",
      stageType: "TECHNICAL_INTERVIEW",
      description: "",
      instructions: "",
      visibleToStudents: true,
      scheduledAt: "",
      location: "",
      isEnabled: true,
    };
    onChange([...drafts.slice(0, -1), stage, ...drafts.slice(-1)]);
    setOpenKey(stage.key);
  };

  const control: React.CSSProperties = {
    padding: "5px 8px",
    fontSize: 12,
    borderRadius: 6,
    border: "0.5px solid var(--border-strong)",
    background: "var(--surface-2)",
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {drafts.map((draft, index) => {
        const bookend = draft.stageType === "APPLICATION" || draft.stageType === "OFFER";
        const open = openKey === draft.key;
        return (
          <div
            key={draft.key}
            style={{
              border: "0.5px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              background: draft.isEnabled ? "var(--surface-1)" : "var(--surface-2)",
              opacity: draft.isEnabled ? 1 : 0.65,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="text-muted" style={{ fontSize: 11, width: 18 }}>{index + 1}.</span>
              {!bookend && (
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <button type="button" aria-label={`Move ${draft.name || "stage"} up`} disabled={index <= 1}
                    onClick={() => move(index, -1)} style={{ border: "none", background: "none", fontSize: 10, padding: 0, cursor: "pointer" }}>▲</button>
                  <button type="button" aria-label={`Move ${draft.name || "stage"} down`} disabled={index >= drafts.length - 2}
                    onClick={() => move(index, 1)} style={{ border: "none", background: "none", fontSize: 10, padding: 0, cursor: "pointer" }}>▼</button>
                </span>
              )}
              <input
                style={{ ...control, flex: 1, minWidth: 160 }}
                value={draft.name}
                maxLength={80}
                placeholder="Stage name"
                aria-label={`Stage ${index + 1} name`}
                onChange={(e) => update(draft.key, { name: e.target.value })}
              />
              <select
                style={control}
                value={draft.stageType}
                disabled={bookend}
                aria-label={`Stage ${index + 1} type`}
                onChange={(e) => update(draft.key, { stageType: e.target.value as RecruitmentStageType })}
              >
                {STAGE_TYPES.filter((type) => bookend || (type !== "APPLICATION" && type !== "OFFER")).map((type) => (
                  <option key={type} value={type}>{STAGE_TYPE_LABELS[type]}</option>
                ))}
              </select>
              {!bookend && (
                <>
                  <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="checkbox" checked={draft.isEnabled}
                      onChange={(e) => update(draft.key, { isEnabled: e.target.checked })} />
                    Active
                  </label>
                  <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="checkbox" checked={draft.visibleToStudents}
                      onChange={(e) => update(draft.key, { visibleToStudents: e.target.checked })} />
                    Shown to students
                  </label>
                </>
              )}
              <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                onClick={() => setOpenKey(open ? null : draft.key)}>
                {open ? "Less" : "Details"}
              </button>
              {!bookend && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--red)" }}
                  onClick={() => onChange(drafts.filter((other) => other.key !== draft.key))}>
                  Remove
                </button>
              )}
            </div>

            {open && (
              <div style={{ display: "grid", gap: 6, marginTop: 8, gridTemplateColumns: "1fr 1fr" }}>
                <input style={control} type="datetime-local" value={draft.scheduledAt}
                  aria-label="Scheduled at" onChange={(e) => update(draft.key, { scheduledAt: e.target.value })} />
                <input style={control} value={draft.location} maxLength={200} placeholder="Location / link"
                  onChange={(e) => update(draft.key, { location: e.target.value })} />
                <textarea style={{ ...control, gridColumn: "1 / -1" }} rows={2} value={draft.description}
                  maxLength={500} placeholder="Description (what this stage is)"
                  onChange={(e) => update(draft.key, { description: e.target.value })} />
                <textarea style={{ ...control, gridColumn: "1 / -1" }} rows={2} value={draft.instructions}
                  maxLength={2000} placeholder="Instructions for candidates"
                  onChange={(e) => update(draft.key, { instructions: e.target.value })} />
              </div>
            )}
          </div>
        );
      })}

      <div>
        <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 11 }}
          disabled={drafts.length >= 15} onClick={addStage}>
          ＋ Add stage
        </button>
      </div>

      {!validation.ok && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--red)" }}>
          {validation.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
    </div>
  );
}
