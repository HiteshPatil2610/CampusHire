import { vi } from "vitest";

/**
 * A department drive's active pipeline, as Prisma returns it — for suites
 * whose subject now touches recruitment (apply, publish, stage changes) but
 * which are about something else.
 */
const stage = (id: string, name: string, stageType: string, sortOrder: number) => ({
  id,
  pipelineVersionId: "rpv_1",
  name,
  stageType,
  sortOrder,
  description: null,
  instructions: null,
  visibleToStudents: true,
  scheduledAt: null,
  location: null,
  isEnabled: true,
});

export const ACTIVE_PIPELINE = {
  id: "rpv_1",
  driveDepartmentConfigId: "config-1",
  version: 1,
  status: "ACTIVE",
  note: null,
  createdById: null,
  createdAt: new Date("2026-09-01"),
  supersededAt: null,
  stages: [
    stage("rst_application", "Application", "APPLICATION", 0),
    stage("rst_technical", "Technical Interview", "TECHNICAL_INTERVIEW", 1),
    stage("rst_offer", "Offer", "OFFER", 2),
  ],
};

/** The Prisma models recruitment reads and writes, as mocks. */
export function pipelineModels() {
  return {
    recruitmentPipelineVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    recruitmentStage: { findUnique: vi.fn() },
    applicationStageEvent: { create: vi.fn(), createMany: vi.fn() },
    pipelineChangeRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

/**
 * Every department drive already has the fixture pipeline active, owned by
 * the department drive `configId`; a stage id resolves to its fixture stage.
 */
export function withActivePipeline(client: unknown, configId = "config-1") {
  const models = client as ReturnType<typeof pipelineModels>;
  models.recruitmentPipelineVersion?.findFirst?.mockResolvedValue(ACTIVE_PIPELINE);
  models.recruitmentPipelineVersion?.count?.mockResolvedValue(1);
  models.recruitmentStage?.findUnique?.mockImplementation((async (args: { where: { id: string } }) => {
    const found = ACTIVE_PIPELINE.stages.find((stage) => stage.id === args.where.id);
    return found
      ? { ...found, pipelineVersion: { driveDepartmentConfigId: configId, version: 1 } }
      : null;
  }) as never);
}
