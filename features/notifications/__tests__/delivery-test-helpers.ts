import { vi } from "vitest";

/**
 * Wiring for tests that exercise a real notification fan-out against a
 * mocked Prisma client.
 *
 * `deliverNotification` re-reads its recipients (only real users, only of
 * the stated role, minus anyone who muted the event) and fan-outs record a
 * `NotificationDispatch`. These helpers give those calls believable
 * behaviour so a test can keep asserting on `notification.createMany`.
 */

type AnyMock = { mockImplementation: (fn: (...args: never[]) => unknown) => unknown };

/** The extra models a fan-out touches, for a `vi.mock("@/lib/prisma")` factory. */
export function notificationModelMocks() {
  return {
    notification: { createMany: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    notificationDispatch: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    notificationPreference: { findUnique: vi.fn(), upsert: vi.fn() },
    departmentAdmin: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  };
}

/**
 * Every recipient exists, holds the role asked for and has muted nothing;
 * `createMany` reports what it was given; the dispatch record succeeds.
 * A test that wants a different answer overrides the mock afterwards.
 */
export function primeDeliveryMocks(prisma: Record<string, Record<string, unknown>>): void {
  const user = prisma.user as { findMany?: AnyMock } | undefined;
  user?.findMany?.mockImplementation(async (args: never) => {
    const where = (args as { where?: { id?: { in?: string[] } } } | undefined)?.where;
    return (where?.id?.in ?? []).map((id) => ({ id, notificationPreference: null }));
  });

  const notification = prisma.notification as
    | { createMany?: AnyMock; count?: AnyMock; findMany?: AnyMock; upsert?: AnyMock }
    | undefined;
  notification?.createMany?.mockImplementation(async (args: never) => ({
    count: ((args as { data?: unknown[] } | undefined)?.data ?? []).length,
  }));
  notification?.count?.mockImplementation(async () => 0);
  notification?.findMany?.mockImplementation(async () => []);
  notification?.upsert?.mockImplementation(async () => ({}));

  const dispatch = prisma.notificationDispatch as
    | { create?: AnyMock; update?: AnyMock; findUnique?: AnyMock; updateMany?: AnyMock }
    | undefined;
  dispatch?.create?.mockImplementation(async () => ({ id: "dispatch-1", attempts: 1 }));
  dispatch?.update?.mockImplementation(async () => ({}));
  dispatch?.findUnique?.mockImplementation(async () => null);
  dispatch?.updateMany?.mockImplementation(async () => ({ count: 0 }));

  const departmentAdmin = prisma.departmentAdmin as { findMany?: AnyMock } | undefined;
  departmentAdmin?.findMany?.mockImplementation(async () => []);
}
