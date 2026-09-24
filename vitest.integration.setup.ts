import fs from "node:fs";
import { parse } from "dotenv";

/**
 * Database integration tests run against a real Postgres — the Neon branch
 * named in `.env.integration.local` — never production.
 *
 * This runs before any test file imports `lib/prisma`, which reads
 * DATABASE_URL once at import time, so pointing DATABASE_URL here is what
 * points every query in the app at the test branch.
 */

const endpointOf = (url: string) => new URL(url).hostname.split(".")[0].replace(/-pooler$/, "");

const local = fs.existsSync(".env.integration.local")
  ? parse(fs.readFileSync(".env.integration.local"))
  : {};
const testUrl = process.env.INTEGRATION_DATABASE_URL ?? local.INTEGRATION_DATABASE_URL;

if (!testUrl) {
  throw new Error(
    "INTEGRATION_DATABASE_URL is not set. Put a Neon test-branch connection string in .env.integration.local."
  );
}

// The guard that matters: refuse outright if this is production's endpoint.
const productionUrl = fs.existsSync(".env") ? parse(fs.readFileSync(".env")).DATABASE_URL : undefined;
if (productionUrl && endpointOf(productionUrl) === endpointOf(testUrl)) {
  throw new Error(
    `Refusing to run integration tests: INTEGRATION_DATABASE_URL points at the production endpoint (${endpointOf(testUrl)}).`
  );
}

process.env.DATABASE_URL = testUrl;
process.env.DATABASE_URL_UNPOOLED = testUrl.replace("-pooler.", ".");
