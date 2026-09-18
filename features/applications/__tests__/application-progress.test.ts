import { describe, it, expect } from "vitest";
import {
  STAGE_SEQUENCE,
  isStageAdvance,
  isTerminalStatus,
  stageIndex,
  validateStageTransition,
} from "../utils/application-progress";

describe("Application stage sequence", () => {
  it("orders the four selection stages", () => {
    expect(STAGE_SEQUENCE).toEqual([
      "APPLIED",
      "APTITUDE",
      "INTERVIEW",
      "OFFER",
    ]);
  });

  it("recognises a forward move", () => {
    expect(isStageAdvance("APPLIED", "INTERVIEW")).toBe(true);
    expect(isStageAdvance("INTERVIEW", "APTITUDE")).toBe(false);
    expect(isStageAdvance("OFFER", "OFFER")).toBe(false);
  });

  it("ranks stages by position", () => {
    expect(stageIndex("APPLIED")).toBe(0);
    expect(stageIndex("OFFER")).toBe(3);
  });

  it("treats every closed outcome as terminal", () => {
    expect(isTerminalStatus("IN_PROGRESS")).toBe(false);
    expect(isTerminalStatus("SELECTED")).toBe(true);
    expect(isTerminalStatus("REJECTED")).toBe(true);
    expect(isTerminalStatus("WITHDRAWN")).toBe(true);
  });
});

describe("validateStageTransition", () => {
  const base = {
    currentStage: "APPLIED",
    currentStatus: "IN_PROGRESS",
  } as const;

  it("allows a normal advance", () => {
    expect(
      validateStageTransition({
        ...base,
        nextStage: "APTITUDE",
        nextStatus: "IN_PROGRESS",
      })
    ).toEqual({ valid: true });
  });

  it("allows an admin to correct a stage backwards", () => {
    expect(
      validateStageTransition({
        currentStage: "INTERVIEW",
        currentStatus: "IN_PROGRESS",
        nextStage: "APTITUDE",
        nextStatus: "IN_PROGRESS",
      })
    ).toEqual({ valid: true });
  });

  it("refuses to change a historical withdrawn application", () => {
    const result = validateStageTransition({
      currentStage: "APPLIED",
      currentStatus: "WITHDRAWN",
      nextStage: "APTITUDE",
      nextStatus: "IN_PROGRESS",
    });

    expect(result.valid).toBe(false);
  });

  it("refuses to move any application into WITHDRAWN", () => {
    const result = validateStageTransition({
      ...base,
      nextStage: "APPLIED",
      nextStatus: "WITHDRAWN",
    });

    expect(result.valid).toBe(false);
  });

  it("requires a selected candidate to sit at the Offer stage", () => {
    expect(
      validateStageTransition({
        ...base,
        nextStage: "INTERVIEW",
        nextStatus: "SELECTED",
      }).valid
    ).toBe(false);

    expect(
      validateStageTransition({
        ...base,
        nextStage: "OFFER",
        nextStatus: "SELECTED",
      })
    ).toEqual({ valid: true });
  });

  it("allows rejection at any stage reached", () => {
    expect(
      validateStageTransition({
        currentStage: "INTERVIEW",
        currentStatus: "IN_PROGRESS",
        nextStage: "INTERVIEW",
        nextStatus: "REJECTED",
      })
    ).toEqual({ valid: true });
  });

  it("rejects a no-op", () => {
    const result = validateStageTransition({
      ...base,
      nextStage: "APPLIED",
      nextStatus: "IN_PROGRESS",
    });

    expect(result.valid).toBe(false);
  });
});
