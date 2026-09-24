import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 7, Item 3 — the master skill list. Review moved from the Super
 * Admin's panel to the department admin's panel afterward, since the list
 * is shared institution-wide but the office that actually curates it is the
 * placement department admins, not the Super Admin.
 *
 *   student types a name
 *   → matched against the list (case/edge-space-insensitive), or
 *   → created PENDING, visible on their profile at once, their department's
 *     admins told
 *   → a department admin approves (lists it for everyone) or rejects
 *     (deletes it, which cascades to every profile that had picked it up —
 *     a database constraint, verified against production in the migration
 *     rehearsal, not something a mocked Prisma client can prove)
 */

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

vi.mock("@/lib/prisma", async () => {
  const { notificationModelMocks } = await import("@/features/notifications/__tests__/delivery-test-helpers");
  return {
    prisma: {
      skill: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      studentSkill: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
      auditLog: { create: vi.fn() },
      user: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(),
      ...notificationModelMocks(),
    },
  };
});

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {}
  return {
    requireStudent: vi.fn(),
    requireDepartmentAdmin: vi.fn(),
    AuthorizationError,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudent, requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { primeDeliveryMocks } from "@/features/notifications/__tests__/delivery-test-helpers";
import { normalizeSkillName } from "../domain/normalize";
import { matchOrCreateSkill } from "../domain/match-or-create-skill";
import { searchSkills } from "../queries/search-skills";
import { approveSkill, rejectSkill } from "../actions/review-skill";
import { addSkill } from "@/features/students/actions/profile-skills";

const STUDENT = { id: "student-1", userId: "user-1", departmentId: "dept-1" };
const REVIEWER = { id: "admin-1" };

/** A Skill row as Prisma would return it. */
function skillRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "skill-1",
    name: "React",
    normalizedName: "react",
    skillType: "TECHNICAL" as const,
    status: "PENDING" as const,
    requestedByStudentId: "student-1",
    approvedById: null,
    approvedAt: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireStudent).mockResolvedValue({ user: { id: STUDENT.userId }, student: STUDENT } as never);
  vi.mocked(requireDepartmentAdmin).mockResolvedValue({
    user: REVIEWER,
    admin: { departmentId: "dept-1" },
    department: { id: "dept-1", code: "CSE" },
  } as never);
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(prisma)
  );
  vi.mocked(prisma.skill.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.skill.deleteMany).mockResolvedValue({ count: 1 } as never);
  primeDeliveryMocks(prisma as never);
});

// ---------------------------------------------------------------------------
// normalizeSkillName — must agree with the database's own CHECK
// ---------------------------------------------------------------------------

describe("normalizeSkillName", () => {
  it("folds case and trims edges, but never touches internal spacing", () => {
    expect(normalizeSkillName("  React  ")).toBe("react");
    expect(normalizeSkillName("Machine  Learning")).toBe("machine  learning");
    expect(normalizeSkillName("C")).toBe("c");
  });
});

// ---------------------------------------------------------------------------
// matchOrCreateSkill — the one place a Skill is found or made
// ---------------------------------------------------------------------------

describe("matchOrCreateSkill", () => {
  it("reuses an exact match regardless of status", () => {
    const existing = skillRow({ status: "APPROVED" });
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(existing as never);

    return matchOrCreateSkill(prisma as never, {
      name: "react",
      skillType: "TECHNICAL",
      requestedByStudentId: "student-2",
    }).then((result) => {
      expect(result).toEqual({ skill: existing, createdNew: false });
      expect(prisma.skill.create).not.toHaveBeenCalled();
    });
  });

  it("matches case- and edge-space-insensitively", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(skillRow() as never);

    await matchOrCreateSkill(prisma as never, {
      name: "  REACT ",
      skillType: "TECHNICAL",
      requestedByStudentId: "student-2",
    });

    expect(prisma.skill.findUnique).toHaveBeenCalledWith({
      where: { normalizedName_skillType: { normalizedName: "react", skillType: "TECHNICAL" } },
    });
  });

  it("6. unknown skill — creates a new PENDING entry, attributed to the requester", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.skill.create).mockResolvedValue(skillRow({ name: "Rust" }) as never);

    const result = await matchOrCreateSkill(prisma as never, {
      name: "Rust",
      skillType: "TECHNICAL",
      requestedByStudentId: "student-2",
    });

    expect(result.createdNew).toBe(true);
    expect(prisma.skill.create).toHaveBeenCalledWith({
      data: {
        name: "Rust",
        normalizedName: "rust",
        skillType: "TECHNICAL",
        status: "PENDING",
        requestedByStudentId: "student-2",
      },
    });
  });

  it("a race for the same new name never produces two entries or two notifications", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null as never);
    const conflict = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
    });
    vi.mocked(prisma.skill.create).mockRejectedValue(conflict);
    const winner = skillRow({ name: "Rust" });
    vi.mocked(prisma.skill.findUniqueOrThrow).mockResolvedValue(winner as never);

    const result = await matchOrCreateSkill(prisma as never, {
      name: "Rust",
      skillType: "TECHNICAL",
      requestedByStudentId: "student-2",
    });

    // The loser of the race gets an ordinary match, not an error.
    expect(result).toEqual({ skill: winner, createdNew: false });
  });
});

// ---------------------------------------------------------------------------
// searchSkills — the autocomplete
// ---------------------------------------------------------------------------

describe("searchSkills", () => {
  it("3. offers only approved skills of the asked-for type, matching the query", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([{ id: "s1", name: "React" }] as never);

    const result = await searchSkills({ query: "rea", skillType: "TECHNICAL" });

    expect(result).toEqual([{ id: "s1", name: "React" }]);
    expect(prisma.skill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "APPROVED",
          skillType: "TECHNICAL",
          name: { contains: "rea", mode: "insensitive" },
        },
      })
    );
  });

  it("browses alphabetically with an empty query, instead of returning nothing", async () => {
    await searchSkills({ query: "", skillType: "SOFT" });

    const [args] = vi.mocked(prisma.skill.findMany).mock.calls[0];
    expect(args).not.toHaveProperty("where.name");
    expect((args as { orderBy: unknown }).orderBy).toEqual({ name: "asc" });
  });

  it("refuses a caller who is not a student", async () => {
    vi.mocked(requireStudent).mockRejectedValueOnce(new AuthorizationError("Students only"));

    await expect(searchSkills({ query: "x", skillType: "TECHNICAL" })).rejects.toThrow("Students only");
  });
});

// ---------------------------------------------------------------------------
// addSkill — the profile action Item 3 changes
// ---------------------------------------------------------------------------

describe("addSkill", () => {
  beforeEach(() => {
    vi.mocked(prisma.studentSkill.findFirst).mockResolvedValue(null as never);
  });

  it("refuses a duplicate already on the student's own profile before touching the master list", async () => {
    vi.mocked(prisma.studentSkill.findFirst).mockResolvedValue({ id: "existing" } as never);

    const result = await addSkill({ skillName: "React", skillType: "TECHNICAL" });

    expect(result).toEqual({ success: false, error: "This skill is already in your profile" });
    expect(prisma.skill.findUnique).not.toHaveBeenCalled();
  });

  it("4. an unmatched name is created PENDING and attached to the student's profile at once", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.skill.create).mockResolvedValue(skillRow({ name: "Rust" }) as never);
    vi.mocked(prisma.studentSkill.create).mockResolvedValue({} as never);

    const result = await addSkill({ skillName: "Rust", skillType: "TECHNICAL" });

    expect(result).toEqual({ success: true });
    expect(prisma.studentSkill.create).toHaveBeenCalledWith({
      data: { studentId: STUDENT.id, skillId: "skill-1", skillName: "Rust", skillType: "TECHNICAL" },
    });
  });

  it("5. tells the student's own department admins once, when — and only when — the name is new", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.skill.create).mockResolvedValue(skillRow({ name: "Rust" }) as never);
    vi.mocked(prisma.studentSkill.create).mockResolvedValue({} as never);
    vi.mocked(prisma.departmentAdmin.findMany).mockResolvedValue([{ userId: REVIEWER.id }] as never);

    await addSkill({ skillName: "Rust", skillType: "TECHNICAL" });

    expect(prisma.departmentAdmin.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ departmentId: STUDENT.departmentId }) })
    );
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    const [call] = vi.mocked(prisma.notification.createMany).mock.calls;
    const rows = (call[0] as { data: Record<string, unknown>[] }).data;
    expect(rows).toEqual([
      expect.objectContaining({
        userId: REVIEWER.id,
        event: "SKILL_PENDING_REVIEW",
        dedupeKey: "skill-pending:skill-1",
        resourceType: "Skill",
        resourceId: "skill-1",
      }),
    ]);
  });

  it("does not notify anyone when the name already matches the list", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(skillRow({ status: "APPROVED" }) as never);
    vi.mocked(prisma.studentSkill.create).mockResolvedValue({} as never);

    await addSkill({ skillName: "React", skillType: "TECHNICAL" });

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("stores the master entry's canonical spelling, not necessarily what was typed", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(skillRow({ name: "React", status: "APPROVED" }) as never);
    vi.mocked(prisma.studentSkill.create).mockResolvedValue({} as never);

    await addSkill({ skillName: "REACT", skillType: "TECHNICAL" });

    expect(prisma.studentSkill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ skillName: "React" }),
    });
  });

  it("a failed notification never fails the save", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.skill.create).mockResolvedValue(skillRow({ name: "Rust" }) as never);
    vi.mocked(prisma.studentSkill.create).mockResolvedValue({} as never);
    vi.mocked(prisma.departmentAdmin.findMany).mockRejectedValueOnce(new Error("db hiccup"));

    const result = await addSkill({ skillName: "Rust", skillType: "TECHNICAL" });

    expect(result).toEqual({ success: true });
  });
});

// ---------------------------------------------------------------------------
// approveSkill / rejectSkill — a department admin's decision
// ---------------------------------------------------------------------------

describe("approveSkill", () => {
  it("6. lists a pending skill for everyone from this moment on", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(skillRow() as never);
    vi.mocked(prisma.skill.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await approveSkill({ skillId: "skill-1" });

    expect(result).toEqual({ success: true, message: expect.stringContaining("React") });
    expect(prisma.skill.updateMany).toHaveBeenCalledWith({
      where: { id: "skill-1", status: "PENDING" },
      data: { status: "APPROVED", approvedById: REVIEWER.id, approvedAt: expect.any(Date) },
    });
  });

  it("refuses one that is not pending, and one reviewed a moment ago by someone else", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue(skillRow({ status: "APPROVED" }) as never);
    expect((await approveSkill({ skillId: "skill-1" })).success).toBe(false);

    vi.mocked(prisma.skill.findUnique).mockResolvedValue(skillRow() as never);
    vi.mocked(prisma.skill.updateMany).mockResolvedValue({ count: 0 } as never);
    const raced = await approveSkill({ skillId: "skill-1" });
    expect(raced).toEqual({ success: false, error: "This skill was just reviewed by someone else." });
  });

  it("only an active department admin may approve", async () => {
    vi.mocked(requireDepartmentAdmin).mockRejectedValueOnce(new AuthorizationError("Department admin only"));

    expect(await approveSkill({ skillId: "skill-1" })).toEqual({ success: false, error: "Department admin only" });
    expect(prisma.skill.findUnique).not.toHaveBeenCalled();
  });
});

describe("rejectSkill", () => {
  it("7. deletes the entry outright — there is no REJECTED status left behind", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({ ...skillRow(), _count: { studentSkills: 3 } } as never);

    const result = await rejectSkill({ skillId: "skill-1", reason: "Not a real skill" });

    expect(result).toEqual({
      success: true,
      message: '"React" was rejected and removed from 3 student profiles.',
    });
    expect(prisma.skill.deleteMany).toHaveBeenCalledWith({ where: { id: "skill-1", status: "PENDING" } });
    // The removal from profiles is the FK's ON DELETE CASCADE, not a second
    // application write — nothing here touches StudentSkill directly.
    expect(prisma.studentSkill.delete).not.toHaveBeenCalled();
  });

  it("records who rejected it, and why, before the row is gone to record it against", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({ ...skillRow(), _count: { studentSkills: 0 } } as never);

    await rejectSkill({ skillId: "skill-1", reason: "Duplicate of an existing entry" });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REJECT",
          entityType: "Skill",
          entityId: "skill-1",
        }),
      })
    );
  });

  it("refuses one already reviewed", async () => {
    vi.mocked(prisma.skill.findUnique).mockResolvedValue({
      ...skillRow({ status: "APPROVED" }),
      _count: { studentSkills: 0 },
    } as never);

    expect((await rejectSkill({ skillId: "skill-1" })).success).toBe(false);
    expect(prisma.skill.deleteMany).not.toHaveBeenCalled();
  });
});
