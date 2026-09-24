import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Fixtures for the database integration tests.
 *
 * The test branch is a copy of production, so every test builds its own
 * department under a random code and scopes every assertion to it — the
 * copied rows are never read, changed or counted. `cleanup` removes
 * everything a world created, children first. Every trigger in the schema
 * guards UPDATE only, so deletes are allowed.
 */

const tagOf = () => `IT${randomBytes(3).toString("hex").toUpperCase()}`;

export interface StudentSpec {
  name: string;
  isPending?: boolean;
  optedIn?: boolean;
  batch?: number | null;
  semester?: number | null;
  activeBacklogs?: number;
  email?: string;
}

export async function createWorld() {
  const tag = tagOf();
  const department = await prisma.department.create({
    data: { name: `Integration ${tag}`, code: tag },
  });
  const admin = await prisma.user.create({
    data: {
      clerkId: `it_admin_${tag}`,
      email: `admin.${tag.toLowerCase()}@integration.test`,
      role: "DEPT_ADMIN",
      name: `Admin ${tag}`,
    },
  });

  const studentIds: string[] = [];
  const driveIds: string[] = [];
  const skillIds: string[] = [];

  async function student(spec: StudentSpec) {
    const created = await prisma.student.create({
      data: {
        departmentId: department.id,
        name: spec.name,
        email: spec.email ?? `${spec.name.toLowerCase().replace(/\W+/g, ".")}.${tag.toLowerCase()}@integration.test`,
        rollNumber: `${tag}-${studentIds.length + 1}`,
        isPending: spec.isPending ?? false,
        optedIn: spec.optedIn ?? true,
        expectedPassoutYear: spec.batch === undefined ? 2027 : spec.batch,
        ...(spec.semester === null
          ? {}
          : {
              academic: {
                create: {
                  tenthPercentage: 80,
                  twelfthPercentage: 80,
                  currentCGPA: 8,
                  currentSemester: spec.semester ?? 7,
                  activeBacklogs: spec.activeBacklogs ?? 0,
                },
              },
            }),
      },
    });
    studentIds.push(created.id);
    return created;
  }

  /** A department drive whose application window is open right now. */
  async function openDrive(overrides: Partial<Prisma.DriveUncheckedCreateInput> = {}) {
    const day = 86_400_000;
    const now = Date.now();
    const drive = await prisma.drive.create({
      data: {
        departmentId: department.id,
        isCentralDrive: false,
        companyName: `Acme ${tag}`,
        roleName: "Engineer",
        packageOffered: 8,
        selectionRounds: "[]",
        applicationStartDate: new Date(now - day),
        applicationDeadline: new Date(now + 7 * day),
        nextStageDate: new Date(now + 14 * day),
        applyMethod: "IN_APP",
        minCGPA: 0,
        maxActiveBacklogs: 5,
        ...overrides,
      },
    });
    driveIds.push(drive.id);
    return drive;
  }

  async function apply(studentId: string, driveId: string) {
    return prisma.driveApplication.create({ data: { studentId, driveId } });
  }

  /** An off-campus placement (no application behind it). */
  async function placeManually(studentId: string) {
    return prisma.studentPlacement.create({
      data: {
        studentId,
        source: "MANUAL",
        companyName: `Offcampus ${tag}`,
        roleName: "Analyst",
        placedAt: new Date(),
        recordedById: admin.id,
      },
    });
  }

  function trackSkill(id: string) {
    skillIds.push(id);
  }

  async function cleanup() {
    const byStudent = { studentId: { in: studentIds } };
    await prisma.studentPlacement.deleteMany({ where: byStudent });
    await prisma.driveApplication.deleteMany({ where: byStudent });
    await prisma.studentSkill.deleteMany({ where: byStudent });
    await prisma.skill.deleteMany({ where: { id: { in: skillIds } } });
    await prisma.drive.deleteMany({ where: { id: { in: driveIds } } });
    await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: admin.id } });
    await prisma.user.deleteMany({ where: { id: admin.id } });
    await prisma.department.deleteMany({ where: { id: department.id } });
  }

  return { tag, department, admin, student, openDrive, apply, placeManually, trackSkill, cleanup };
}

export type World = Awaited<ReturnType<typeof createWorld>>;
