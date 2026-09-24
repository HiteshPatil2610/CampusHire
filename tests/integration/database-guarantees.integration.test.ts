import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

/**
 * The guarantees the database itself enforces — CHECK constraints, unique
 * indexes, triggers and ON DELETE CASCADE. Unit tests mock Prisma, so none of
 * these had ever run in a test before.
 */

const ctx = vi.hoisted(() => ({ adminId: "", departmentId: "" }));

vi.mock("@/lib/auth", () => ({
  requireDepartmentAdmin: vi.fn(async () => ({
    user: { id: ctx.adminId, role: "DEPT_ADMIN" },
    department: { id: ctx.departmentId },
  })),
  AuthorizationError: class AuthorizationError extends Error {},
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createWorld, type World } from "./fixtures";
import { rejectSkill } from "@/features/skills/actions/review-skill";

let world: World;

beforeAll(async () => {
  world = await createWorld();
  ctx.adminId = world.admin.id;
  ctx.departmentId = world.department.id;
});

afterAll(async () => {
  await world?.cleanup();
});

describe("student identity (Item 1)", () => {
  it("refuses an MIS number of the wrong shape", async () => {
    const student = await world.student({ name: "Shape" });
    await expect(
      prisma.student.update({ where: { id: student.id }, data: { misNumber: "ab" } })
    ).rejects.toThrow(/Student_mis_number_shape/);
  });

  it("refuses two students with the same MIS number", async () => {
    const first = await world.student({ name: "First" });
    const second = await world.student({ name: "Second" });
    const mis = `9${world.tag.slice(2)}1`;
    await prisma.student.update({ where: { id: first.id }, data: { misNumber: mis } });
    await expect(
      prisma.student.update({ where: { id: second.id }, data: { misNumber: mis } })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("refuses a batch outside 2000–2100", async () => {
    await expect(world.student({ name: "Future", batch: 2200 })).rejects.toThrow(/Student_passout_year_range/);
  });
});

describe("drive origin (Item 16)", () => {
  it("refuses a central drive that also has an owning department", async () => {
    await expect(world.openDrive({ isCentralDrive: true })).rejects.toThrow(/Drive_origin_consistent/);
  });

  it("refuses an application window that ends before it starts (Item 12)", async () => {
    const now = Date.now();
    await expect(
      world.openDrive({
        applicationStartDate: new Date(now),
        applicationDeadline: new Date(now - 86_400_000),
      })
    ).rejects.toThrow(/Drive_application_window_order/);
  });
});

describe("placement history (StudentPlacement trigger)", () => {
  it("refuses editing a placement, allows one revocation, refuses a second", async () => {
    const student = await world.student({ name: "History" });
    const placement = await world.placeManually(student.id);

    await expect(
      prisma.studentPlacement.update({ where: { id: placement.id }, data: { companyName: "Changed" } })
    ).rejects.toThrow(/cannot be edited/);

    await prisma.studentPlacement.update({
      where: { id: placement.id },
      data: { revokedAt: new Date(), revokedById: world.admin.id, revokeReason: "Recorded by mistake" },
    });

    await expect(
      prisma.studentPlacement.update({
        where: { id: placement.id },
        data: { revokeReason: "Changed my mind about why" },
      })
    ).rejects.toThrow(/revoked placement cannot be changed/);
  });

  it("refuses a manual placement that points at an application", async () => {
    const student = await world.student({ name: "Mismatch" });
    const drive = await world.openDrive();
    const application = await world.apply(student.id, drive.id);
    await expect(
      prisma.studentPlacement.create({
        data: {
          studentId: student.id,
          source: "MANUAL",
          applicationId: application.id,
          companyName: "X",
          roleName: "Y",
          placedAt: new Date(),
        },
      })
    ).rejects.toThrow(/StudentPlacement_source_matches_reference/);
  });
});

describe("skill master list (Item 3)", () => {
  it("refuses a normalized name that does not match the name", async () => {
    await expect(
      prisma.skill.create({
        data: { name: `Real ${world.tag}`, normalizedName: "something else", skillType: "TECHNICAL" },
      })
    ).rejects.toThrow(/Skill_normalizedName_matches_name/);
  });

  it("rejecting a skill removes it from every profile that had it — by cascade, for real", async () => {
    const a = await world.student({ name: "Skill A" });
    const b = await world.student({ name: "Skill B" });
    const name = `Quantum${world.tag}`;
    const skill = await prisma.skill.create({
      data: {
        name,
        normalizedName: name.toLowerCase(),
        skillType: "TECHNICAL",
        status: "PENDING",
        requestedByStudentId: a.id,
      },
    });
    world.trackSkill(skill.id);
    for (const s of [a, b]) {
      await prisma.studentSkill.create({
        data: { studentId: s.id, skillId: skill.id, skillName: name, skillType: "TECHNICAL" },
      });
    }

    const result = await rejectSkill({ skillId: skill.id, reason: "Not a real skill" });

    expect(result).toEqual({ success: true, message: `"${name}" was rejected and removed from 2 student profiles.` });
    expect(await prisma.skill.count({ where: { id: skill.id } })).toBe(0);
    expect(await prisma.studentSkill.count({ where: { skillName: name } })).toBe(0);
    // Audited before the row was gone, against the reviewing admin.
    expect(
      await prisma.auditLog.count({ where: { entityId: skill.id, action: "REJECT", userId: world.admin.id } })
    ).toBe(1);
  });
});
