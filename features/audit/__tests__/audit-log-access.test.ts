import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Reading the audit log.
 *
 * The audit trail is the record of who did what, so who may read it is part
 * of the trail's value. Two things are checked here: that only the Super
 * Admin gets it, and that a refusal *says* it is a refusal.
 *
 * The second one is a regression test. The action used to recognise a refusal
 * by looking for the words "Unauthorized" or "Super Admin" in the error's
 * message, and `requireRole` writes "SUPER_ADMIN" — so the branch never fired
 * and a department admin who reached this action was told the log had failed
 * to load. The error's type is now what decides.
 */

vi.mock("@/lib/auth", () => {
  class AuthenticationError extends Error {
    constructor(message = "Authentication required") {
      super(message);
      this.name = "AuthenticationError";
    }
  }
  class AuthorizationError extends Error {
    constructor(message = "Insufficient permissions") {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  return {
    requireSuperAdmin: vi.fn(),
    AuthenticationError,
    AuthorizationError,
  };
});

vi.mock("../queries/get-audit-logs", () => ({
  getAuditLogs: vi.fn(async () => ({ data: [], page: 1, pageSize: 25, totalCount: 0 })),
}));

import { requireSuperAdmin, AuthenticationError, AuthorizationError } from "@/lib/auth";
import { getAuditLogs } from "../queries/get-audit-logs";
import { getAuditLogsAction } from "../actions/get-audit-logs-action";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

describe("getAuditLogsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(getAuditLogs).mockResolvedValue({
      data: [],
      page: 1,
      pageSize: 25,
      totalCount: 0,
    });
  });

  it("tells a department admin they lack permission, not that it failed", async () => {
    asMock(requireSuperAdmin).mockRejectedValue(
      new AuthorizationError("This action requires SUPER_ADMIN role. You have DEPT_ADMIN role.")
    );

    const result = await getAuditLogsAction({});

    expect(result.success).toBe(false);
    expect(result.error).toBe("You don't have permission to view audit logs.");
  });

  it("says the same for a caller who is not signed in", async () => {
    asMock(requireSuperAdmin).mockRejectedValue(new AuthenticationError());

    const result = await getAuditLogsAction({});

    expect(result.success).toBe(false);
    expect(result.error).toBe("You don't have permission to view audit logs.");
  });

  it("does not read the log when the caller is refused", async () => {
    asMock(requireSuperAdmin).mockRejectedValue(new AuthorizationError());

    await getAuditLogsAction({});

    expect(getAuditLogs).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure as a failure, not as a refusal", async () => {
    asMock(requireSuperAdmin).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" });
    asMock(getAuditLogs).mockRejectedValue(new Error("connection reset"));

    const result = await getAuditLogsAction({});

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to load audit logs. Please try again.");
  });

  it("returns the log to the Super Admin", async () => {
    asMock(requireSuperAdmin).mockResolvedValue({ id: "super-1", role: "SUPER_ADMIN" });

    const result = await getAuditLogsAction({});

    expect(result.success).toBe(true);
    expect(getAuditLogs).toHaveBeenCalled();
  });
});
