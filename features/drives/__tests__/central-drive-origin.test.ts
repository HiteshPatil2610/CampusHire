import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Item 16: the Super Admin's central-drive views show only drives the Super
 * Admin posted. Origin is `Drive.isCentralDrive`, set server-side at creation
 * (and tied to departmentId by a CHECK), and every central listing filters
 * on it — a department's own drive never appears there.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    drive: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "user-super", role: "SUPER_ADMIN" })),
}));

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { getCentralDrives, getRecentCentralDrives } from "../queries/get-central-drives";

const whereOf = (index = 0) =>
  (vi.mocked(prisma.drive.findMany).mock.calls[index][0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.drive.findMany).mockResolvedValue([]);
  vi.mocked(prisma.drive.count).mockResolvedValue(0);
});

describe("central drive views filter by origin", () => {
  it("the dashboard's Central drives card asks for central drives only", async () => {
    await getRecentCentralDrives();
    expect(whereOf()).toEqual({ isCentralDrive: true });
  });

  it("the Central Drives page asks for central drives only", async () => {
    await getCentralDrives({ page: 1, pageSize: 25 });
    expect(whereOf()).toMatchObject({ isCentralDrive: true });
  });

  it("is refused for anyone but the Super Admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValueOnce(new Error("This action requires SUPER_ADMIN role."));
    await expect(getRecentCentralDrives()).rejects.toThrow();
    expect(prisma.drive.findMany).not.toHaveBeenCalled();
  });
});
