import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(), // Optional for local dev
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/"),

  // Where the app is reachable, for links CampusHire asks Clerk to send
  // (an admin invitation). Optional: without it Clerk uses its own default
  // redirect, which still works.
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Who a removed admin can write to about it, shown on the Access Revoked
  // page. Optional: without it the page points them to the placement office.
  SUPPORT_CONTACT_EMAIL: z.string().email().optional(),

  // Vercel Blob Storage
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(), // Optional for local dev without Blob

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// Parse and validate environment variables at module load
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
