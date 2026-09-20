import { vi } from "vitest";

/**
 * React's `cache` outside a request.
 *
 * `lib/auth.ts` memoises every authorization lookup with React's `cache`, so
 * that one render pays for one `user` query rather than five. `cache` lives in
 * React's server build, which Next resolves at build time and a test run does
 * not — importing `lib/auth` under vitest therefore threw "cache is not a
 * function" before the suite could start, and any suite that reached an
 * authorization helper failed to load at all.
 *
 * Memoisation is a performance property, not a behavioural one: every helper
 * returns the same answer called once or five times. So here `cache` is the
 * identity, and the helpers run uncached — which is what a test wants anyway,
 * since it lets a suite change what the database returns between calls.
 */
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: (fn: unknown) => fn };
});
