/**
 * Check that Postgres and Clerk agree about who is who.
 *
 *   npx tsx scripts/verify-role-sync.ts
 *
 * User.role in Postgres is authoritative; Clerk's publicMetadata.role is a
 * cache that middleware reads for a fast routing decision. They drift after a
 * database restore, after switching Clerk applications, or when a webhook is
 * missed — and nothing surfaces the drift on its own, because middleware
 * treats a missing role as "not set up yet" and lets the request through.
 *
 * Reports three kinds of problem:
 *   - role mismatch        Postgres and Clerk disagree
 *   - orphaned User row    the clerkId is not in this Clerk application
 *   - unlinked Clerk user  exists in Clerk with no User row here
 *
 * Read-only. It changes nothing; fixes are suggested at the end.
 */
import { config } from 'dotenv';
config({ path: '.env', override: true });
config({ path: '.env.local', override: true });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SECRET = process.env.CLERK_SECRET_KEY;

interface ClerkUser {
  id: string;
  public_metadata?: Record<string, unknown>;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string;
}

(async () => {
  if (!SECRET) {
    console.error('\nCLERK_SECRET_KEY not set in .env.local\n');
    process.exit(1);
  }

  const res = await fetch('https://api.clerk.com/v1/users?limit=100', {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  if (!res.ok) {
    console.error(`\nClerk API returned ${res.status}. Check CLERK_SECRET_KEY.\n`);
    process.exit(1);
  }
  const clerkUsers = (await res.json()) as ClerkUser[];
  const byId = new Map(clerkUsers.map((u) => [u.id, u]));

  // Say which Clerk application answered. The publishable key is base64 of the
  // instance's frontend domain, so it identifies the instance without printing
  // a secret — and swapping applications is otherwise invisible from the output.
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  let instance = '(could not decode publishable key)';
  try {
    instance = Buffer.from(pk.replace(/^pk_(test|live)_/, ''), 'base64')
      .toString('utf8')
      .replace(/\$$/, '');
  } catch {
    /* keep the fallback */
  }
  const dbHost = (process.env.DATABASE_URL ?? '').match(/@([^/]+)/)?.[1] ?? 'unknown';
  console.log(`\nClerk instance: ${instance}`);
  console.log(`Database:       ${dbHost}`);

  const dbUsers = await prisma.user.findMany({
    select: { id: true, email: true, role: true, clerkId: true },
    orderBy: { createdAt: 'asc' },
  });

  const emailOf = (u: ClerkUser) =>
    u.email_addresses?.find((e) => e.id === u.primary_email_address_id)?.email_address ?? '(no email)';

  console.log(`\nPostgres users: ${dbUsers.length}   Clerk users: ${clerkUsers.length}\n`);

  const mismatched: string[] = [];
  const orphaned: string[] = [];

  console.log('Postgres side');
  for (const u of dbUsers) {
    const c = byId.get(u.clerkId);
    if (!c) {
      orphaned.push(u.email);
      console.log(`  ${u.email.padEnd(34)} db=${u.role.padEnd(12)} ORPHAN — clerkId not in this Clerk app`);
      continue;
    }
    const clerkRole = (c.public_metadata?.role as string) ?? '(none)';
    const ok = clerkRole === u.role;
    if (!ok) mismatched.push(u.email);
    console.log(`  ${u.email.padEnd(34)} db=${u.role.padEnd(12)} clerk=${clerkRole.padEnd(12)} ${ok ? 'ok' : 'MISMATCH'}`);
  }

  const linked = new Set(dbUsers.map((u) => u.clerkId));
  const unlinked = clerkUsers.filter((c) => !linked.has(c.id));

  if (unlinked.length) {
    console.log('\nIn Clerk with no Postgres row (they get one on first sign-in)');
    for (const c of unlinked) {
      const meta = JSON.stringify(c.public_metadata ?? {});
      console.log(`  ${emailOf(c).padEnd(34)} publicMetadata=${meta}`);
    }
  }

  // Metadata that points at rows which may not exist in this database.
  const deptIds = new Set(
    clerkUsers
      .map((c) => c.public_metadata?.departmentId)
      .filter((d): d is string => typeof d === 'string')
  );
  if (deptIds.size) {
    const present = await prisma.department.findMany({
      where: { id: { in: [...deptIds] } },
      select: { id: true },
    });
    const have = new Set(present.map((d) => d.id));
    const dangling = [...deptIds].filter((d) => !have.has(d));
    if (dangling.length) {
      console.log('\nClerk metadata referencing departments not in this database');
      for (const d of dangling) console.log(`  departmentId=${d}`);
    }
  }

  console.log('');
  if (!mismatched.length && !orphaned.length && !unlinked.length) {
    console.log('Postgres and Clerk agree.\n');
  } else {
    if (mismatched.length) {
      console.log(`${mismatched.length} role mismatch(es). Fix each with:`);
      for (const e of mismatched) console.log(`  npx tsx scripts/sync-role-to-clerk.ts ${e}`);
    }
    if (orphaned.length) {
      console.log(`\n${orphaned.length} orphaned Postgres row(s): ${orphaned.join(', ')}`);
      console.log('  Their clerkId belongs to a different Clerk application. Because');
      console.log('  User.email is unique, the same person signing up again cannot get');
      console.log('  a row and will fail. Delete the stale row, or re-point its clerkId.');
    }
    if (unlinked.length) {
      console.log(`\n${unlinked.length} Clerk user(s) with no row here — normal if they have not signed in yet.`);
      console.log('  Stale publicMetadata on them (a role, a departmentId) is read by');
      console.log('  middleware before any row exists, so clear it if it is left over');
      console.log('  from another database.');
    }
    console.log('');
  }

  await prisma.$disconnect();
})();
