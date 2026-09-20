import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * What "disabled" means at the door.
 *
 * Every department-scoped path in CampusHire resolves its department through
 * `requireDepartmentAdmin` or `getActiveDepartmentAdmin`. So the guarantee
 * the unit asks for — a disabled admin loses department admin authorization —
 * holds exactly as far as these two functions do, and that is what is tested
 * here. A last test reads the source of the feature modules to check that no
 * path has quietly gone around them.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    departmentAdmin: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "clerk-1" })),
  clerkClient: vi.fn(async () => ({ users: { getUser: vi.fn(), updateUserMetadata: vi.fn() } })),
}));

// The real `cache` is React's per-request memo, which needs a request.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: (fn: unknown) => fn };
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getActiveDepartmentAdmin, requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";

const CSE = "dept-cse";

const admin = (overrides: object = {}) => ({
  id: "admin-1",
  userId: "user-1",
  departmentId: CSE,
  status: "ACTIVE",
  department: { id: CSE, code: "CSE", name: "Computer Science", isActive: true },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: "user-1",
    clerkId: "clerk-1",
    email: "admin@college.edu",
    role: "DEPT_ADMIN",
  } as never);
});

describe("getActiveDepartmentAdmin", () => {
  it("answers for a live authorization", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(admin() as never);

    expect(await getActiveDepartmentAdmin("user-1")).toMatchObject({ departmentId: CSE });
  });

  it("answers null once disabled", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({ status: "DISABLED" }) as never
    );

    expect(await getActiveDepartmentAdmin("user-1")).toBeNull();
  });

  it("answers null while the department is inactive", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({ department: { id: CSE, code: "CSE", name: "CS", isActive: false } }) as never
    );

    expect(await getActiveDepartmentAdmin("user-1")).toBeNull();
  });

  it("answers null when there is no authorization at all", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(null as never);

    expect(await getActiveDepartmentAdmin("user-1")).toBeNull();
  });
});

describe("requireDepartmentAdmin", () => {
  it("lets an active admin through", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(admin() as never);

    const context = await requireDepartmentAdmin();

    expect(context.department.code).toBe("CSE");
  });

  it("refuses a disabled one, and says why", async () => {
    vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(
      admin({ status: "DISABLED" }) as never
    );

    await expect(requireDepartmentAdmin()).rejects.toBeInstanceOf(AuthorizationError);
    await expect(requireDepartmentAdmin()).rejects.toThrow(/disabled/i);
  });
});

describe("no path goes around the check", () => {
  it("resolves a department admin only through the auth helpers", () => {
    const offenders: string[] = [];
    const root = join(process.cwd(), "features");

    const walk = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== "__tests__") walk(path);
          continue;
        }
        if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;

        const source = readFileSync(path, "utf8");
        // The admin-accounts feature manages these rows, so it reads them
        // directly by design.
        if (path.includes(join("features", "admin-accounts"))) continue;

        // Anywhere else, a read of a department admin must either go through
        // the auth helper or say which status it wants — a read that takes
        // any row would hand a disabled admin their department back.
        for (const match of source.matchAll(/departmentAdmin\.(findUnique|findFirst|findMany)\(([\s\S]{0,200})/g)) {
          if (!match[2].includes("status")) {
            offenders.push(`${path.replace(process.cwd(), "")} (${match[1]})`);
          }
        }
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });
});
