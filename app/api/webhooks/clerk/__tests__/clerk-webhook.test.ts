import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Clerk webhook.
 *
 * This is the one route an unauthenticated stranger can POST to, and what it
 * does — create a user, set a role, delete an account — is exactly what an
 * attacker would want. So the first thing tested here is that nothing happens
 * at all without a valid Svix signature: no signature, wrong signature, or no
 * configured secret must each stop before a single query.
 *
 * After that, the contract the rest of the app leans on: a signed-up account
 * is a STUDENT unless an open invitation says otherwise (the email alone never
 * promotes anyone), the write is idempotent because Clerk retries, and the
 * role is mirrored into Clerk's metadata for the middleware — best-effort,
 * because the database is the authority and a failed mirror must not lose the
 * user.
 */

/**
 * The route reads the Svix headers through `next/headers`, which only exists
 * inside a real request. The stub hands it whatever the test's Request carries,
 * so a test can still say "this delivery arrived unsigned".
 */
const incomingHeaders = { current: new Headers() };
vi.mock("next/headers", () => ({
  headers: async () => incomingHeaders.current,
}));

const verify = vi.fn();
vi.mock("svix", () => ({
  Webhook: class {
    constructor(public secret: string) {}
    verify(...args: unknown[]) {
      return verify(...args);
    }
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

const updateUserMetadata = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({ users: { updateUserMetadata } })),
}));

const applyAdminInvitation = vi.fn(async () => ({ applied: false }));
vi.mock("@/features/admin-accounts/domain/accept-invitation", () => ({
  applyAdminInvitation: (...args: unknown[]) => applyAdminInvitation(...(args as [])),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const SIGNED_HEADERS = {
  "svix-id": "msg_1",
  "svix-timestamp": "1700000000",
  "svix-signature": "v1,signature",
};

const request = (body: unknown, headers: Record<string, string> = SIGNED_HEADERS) => {
  incomingHeaders.current = new Headers({ "content-type": "application/json", ...headers });
  return new Request("https://campushire.test/api/webhooks/clerk", {
    method: "POST",
    headers: incomingHeaders.current,
    body: JSON.stringify(body),
  }) as never;
};

const userCreated = (overrides: Record<string, unknown> = {}) => ({
  type: "user.created",
  data: {
    id: "clerk_new",
    email_addresses: [{ id: "email_1", email_address: "student@college.edu" }],
    primary_email_address_id: "email_1",
    first_name: "Asha",
    last_name: "Rao",
    public_metadata: {},
    ...overrides,
  },
});

describe("Clerk webhook — signature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
    asMock(prisma.user.upsert).mockResolvedValue({
      id: "user-1",
      clerkId: "clerk_new",
      email: "student@college.edu",
      role: "STUDENT",
    });
    applyAdminInvitation.mockResolvedValue({ applied: false });
  });

  it("refuses a request with no Svix headers, and reads nothing", async () => {
    const response = await POST(request(userCreated(), {}));

    expect(response.status).toBe(400);
    expect(verify).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("refuses a forged signature, and reads nothing", async () => {
    verify.mockImplementation(() => {
      throw new Error("No matching signature found");
    });

    const response = await POST(request(userCreated()));

    expect(response.status).toBe(400);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("refuses to run at all when no secret is configured", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;

    const response = await POST(request(userCreated()));

    expect(response.status).toBe(500);
    expect(verify).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("verifies the raw body, not a re-serialised copy", async () => {
    verify.mockReturnValue(userCreated());

    await POST(request(userCreated()));

    const [body, headers] = verify.mock.calls[0] as [string, Record<string, string>];
    expect(JSON.parse(body).type).toBe("user.created");
    expect(headers).toMatchObject(SIGNED_HEADERS);
  });
});

describe("Clerk webhook — user.created", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
    asMock(prisma.user.upsert).mockResolvedValue({
      id: "user-1",
      clerkId: "clerk_new",
      email: "student@college.edu",
      role: "STUDENT",
    });
    applyAdminInvitation.mockResolvedValue({ applied: false });
  });

  it("creates the account as a STUDENT", async () => {
    verify.mockReturnValue(userCreated());

    const response = await POST(request(userCreated()));

    expect(response.status).toBe(200);
    const call = asMock(prisma.user.upsert).mock.calls[0]![0];
    expect(call.where).toEqual({ clerkId: "clerk_new" });
    expect(call.create).toMatchObject({
      clerkId: "clerk_new",
      email: "student@college.edu",
      name: "Asha Rao",
      role: "STUDENT",
    });
  });

  it("upserts, so a retried delivery does not create a second account", async () => {
    verify.mockReturnValue(userCreated());

    await POST(request(userCreated()));
    await POST(request(userCreated()));

    expect(asMock(prisma.user.upsert)).toHaveBeenCalledTimes(2);
    // Both are upserts on the same clerkId — never a create.
    for (const [call] of asMock(prisma.user.upsert).mock.calls) {
      expect(call.where).toEqual({ clerkId: "clerk_new" });
    }
  });

  it("never overwrites a stored name with a blank one", async () => {
    verify.mockReturnValue(userCreated({ first_name: null, last_name: null }));

    await POST(request(userCreated()));

    const call = asMock(prisma.user.upsert).mock.calls[0]![0];
    expect(call.update).not.toHaveProperty("name");
    expect(call.create.name).toBeNull();
  });

  it("does nothing when Clerk sends no primary email", async () => {
    verify.mockReturnValue(
      userCreated({ email_addresses: [], primary_email_address_id: null })
    );

    const response = await POST(request(userCreated()));

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("asks the invitation domain to decide the role — the email alone promotes nobody", async () => {
    verify.mockReturnValue(
      userCreated({ public_metadata: { role: "SUPER_ADMIN", departmentId: "dept-x" } })
    );

    await POST(request(userCreated()));

    // The metadata is passed along as evidence, never applied as fact: the
    // account is still created as a STUDENT and only `applyAdminInvitation`,
    // which needs an open invitation, can change that.
    expect(applyAdminInvitation).toHaveBeenCalledWith({
      userId: "user-1",
      email: "student@college.edu",
      metadata: { role: "SUPER_ADMIN", departmentId: "dept-x" },
    });
    expect(asMock(prisma.user.upsert).mock.calls[0]![0].create.role).toBe("STUDENT");
  });

  it("mirrors the resulting role into Clerk metadata for the middleware", async () => {
    verify.mockReturnValue(userCreated());
    applyAdminInvitation.mockResolvedValue({ applied: true });

    await POST(request(userCreated()));

    expect(updateUserMetadata).toHaveBeenCalledWith("clerk_new", {
      publicMetadata: { role: "DEPT_ADMIN" },
    });
  });

  it("keeps the account when the metadata mirror fails — the database is the authority", async () => {
    verify.mockReturnValue(userCreated());
    updateUserMetadata.mockRejectedValue(new Error("Clerk is down"));

    const response = await POST(request(userCreated()));

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalled();
  });

  it("keeps the account when the invitation step throws", async () => {
    verify.mockReturnValue(userCreated());
    applyAdminInvitation.mockRejectedValue(new Error("boom"));

    const response = await POST(request(userCreated()));

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).toHaveBeenCalled();
  });
});

describe("Clerk webhook — user.updated and user.deleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
    asMock(prisma.user.update).mockResolvedValue({
      id: "user-1",
      clerkId: "clerk_new",
      email: "new@college.edu",
    });
    asMock(prisma.user.delete).mockResolvedValue({
      id: "user-1",
      clerkId: "clerk_new",
      email: "student@college.edu",
    });
  });

  it("syncs a changed email, and never touches the role", async () => {
    verify.mockReturnValue({
      type: "user.updated",
      data: {
        id: "clerk_new",
        email_addresses: [{ id: "e1", email_address: "new@college.edu" }],
        primary_email_address_id: "e1",
        first_name: "Asha",
        last_name: "Rao",
      },
    });

    await POST(request({}));

    const call = asMock(prisma.user.update).mock.calls[0]![0];
    expect(call.where).toEqual({ clerkId: "clerk_new" });
    expect(call.data).toEqual({ email: "new@college.edu", name: "Asha Rao" });
    // A webhook cannot promote anyone.
    expect(call.data).not.toHaveProperty("role");
  });

  it("deletes by clerkId when Clerk deletes the account", async () => {
    verify.mockReturnValue({ type: "user.deleted", data: { id: "clerk_new" } });

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    expect(asMock(prisma.user.delete).mock.calls[0]![0].where).toEqual({
      clerkId: "clerk_new",
    });
  });

  it("acknowledges an event it does not handle, without writing", async () => {
    verify.mockReturnValue({ type: "session.created", data: { id: "sess_1" } });

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("acknowledges a failed write rather than inviting an endless retry", async () => {
    verify.mockReturnValue({ type: "user.deleted", data: { id: "clerk_new" } });
    asMock(prisma.user.delete).mockRejectedValue(new Error("no such row"));

    const response = await POST(request({}));

    expect(response.status).toBe(200);
  });
});
