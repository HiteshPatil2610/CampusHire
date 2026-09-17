/**
 * Take a local backup of the database.
 *
 *   npm run db:backup
 *
 * Neon's own point-in-time restore is capped at 6 hours on the free tier, and
 * the free plan holds a single snapshot. Neither is enough to rely on: a
 * mistake noticed the next morning is already outside the window. A dump costs
 * nothing, keeps as long as you keep the file, and does not depend on the
 * account it came from — which matters most in exactly the situation where you
 * need it.
 *
 * Writes a compressed custom-format dump, which `pg_restore` can restore whole
 * or a single table at a time.
 *
 * Restore into an empty database:
 *   pg_restore --dbname "<connection string>" --clean --if-exists backups/<file>
 *
 * Inspect without restoring:
 *   pg_restore --list backups/<file>
 */
import { config } from 'dotenv';
// .env.local holds the hand-managed keys; .env is written by the Neon CLI and
// owns DATABASE_URL. dotenv does not overwrite an already-set variable, so
// this order reproduces Next.js's precedence.
config({ path: '.env.local' });
config({ path: '.env' });

import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BACKUP_DIR = 'backups';

// The direct (unpooled) endpoint is the right one for a dump: pgbouncer in
// transaction mode cannot hold the single consistent snapshot pg_dump wants.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('\nNo DATABASE_URL_UNPOOLED or DATABASE_URL found in .env / .env.local\n');
  process.exit(1);
}

const host = url.match(/@([^/]+)/)?.[1] ?? 'unknown';
const dbName = url.match(/\/([A-Za-z0-9_-]+)\?/)?.[1] ?? 'database';

if (spawnSync('pg_dump', ['--version'], { encoding: 'utf8' }).error) {
  console.error('\npg_dump not found on PATH. Install the PostgreSQL client tools.');
  console.error('Windows: https://www.postgresql.org/download/windows/ (the client');
  console.error('package alone is enough — you do not need a local server).\n');
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const outFile = join(BACKUP_DIR, `${dbName}_${stamp}.dump`);

console.log(`\nhost: ${host}`);
console.log(`db:   ${dbName}`);
console.log(`into: ${outFile}\n`);

const res = spawnSync(
  'pg_dump',
  ['--format=custom', '--compress=9', '--no-owner', '--no-privileges', '--file', outFile, url],
  { stdio: ['ignore', 'inherit', 'inherit'] }
);

if (res.status !== 0) {
  console.error(`\npg_dump exited with ${res.status}. Nothing was written.\n`);
  process.exit(res.status ?? 1);
}

const bytes = statSync(outFile).size;
const size = bytes > 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${(bytes / 1024).toFixed(0)} KB`;

console.log(`\nWrote ${size}`);

const all = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.dump')).sort();
console.log(`${all.length} backup${all.length === 1 ? '' : 's'} in ${BACKUP_DIR}/`);
for (const f of all.slice(-5)) console.log(`  ${f}`);
if (all.length > 5) console.log(`  … and ${all.length - 5} older`);

console.log(`\nRestore:  pg_restore --dbname "<connection string>" --clean --if-exists ${outFile}`);
console.log(`Inspect:  pg_restore --list ${outFile}\n`);
