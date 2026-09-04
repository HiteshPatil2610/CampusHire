import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * Clerk Webhook Handler
 * 
 * Handles user lifecycle events from Clerk:
 * - user.created: Create CampusHire User record
 * - user.updated: Sync email updates
 * - user.deleted: Handle user deletion
 * 
 * Security: Verifies webhook signature using CLERK_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  // Get the Webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the webhook signature
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as unknown as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error: Invalid signature", { status: 400 });
  }

  // Handle the webhook event
  const eventType = evt.type;

  try {
    switch (eventType) {
      case "user.created":
        await handleUserCreated(evt);
        break;

      case "user.updated":
        await handleUserUpdated(evt);
        break;

      case "user.deleted":
        await handleUserDeleted(evt);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return new Response("Webhook processed successfully", { status: 200 });
  } catch (error) {
    console.error(`Error processing webhook ${eventType}:`, error);
    // Return 200 to prevent Clerk from retrying
    // Log error for manual review
    return new Response("Webhook received but processing failed", { status: 200 });
  }
}

/**
 * Handle user.created event
 * Creates a new User record in the database with STUDENT role (default for self-registration)
 */
async function handleUserCreated(evt: WebhookEvent) {
  if (evt.type !== "user.created") return;

  const { id: clerkId, email_addresses, primary_email_address_id } = evt.data;

  // Get primary email
  const primaryEmail = email_addresses.find(
    (email) => email.id === primary_email_address_id
  );

  if (!primaryEmail?.email_address) {
    console.error("No primary email found for user:", clerkId);
    return;
  }

  const email = primaryEmail.email_address;

  // Create User record with STUDENT role (default for self-registration)
  // Use upsert for idempotency (handles duplicate webhook events)
  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {
      email, // Update email if user already exists
    },
    create: {
      clerkId,
      email,
      role: "STUDENT", // Default role for self-registration
    },
  });

  console.log(`User created/updated in database:`, {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    role: user.role,
  });

  // Sync role to Clerk publicMetadata for middleware performance
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: user.role,
      },
    });
    console.log(`Role synced to Clerk metadata for user ${clerkId}`);
  } catch (error) {
    console.error(`Failed to sync role to Clerk metadata:`, error);
    // Don't throw - user is created, metadata sync can be retried later
  }
}

/**
 * Handle user.updated event
 * Syncs email changes from Clerk to database
 */
async function handleUserUpdated(evt: WebhookEvent) {
  if (evt.type !== "user.updated") return;

  const { id: clerkId, email_addresses, primary_email_address_id } = evt.data;

  // Get primary email
  const primaryEmail = email_addresses.find(
    (email) => email.id === primary_email_address_id
  );

  if (!primaryEmail?.email_address) {
    console.error("No primary email found for user:", clerkId);
    return;
  }

  const email = primaryEmail.email_address;

  // Update user email in database
  const user = await prisma.user.update({
    where: { clerkId },
    data: { email },
  });

  console.log(`User email updated in database:`, {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
  });
}

/**
 * Handle user.deleted event
 * Handles user deletion from Clerk
 * Cascade delete will automatically remove related records (Student, DepartmentAdmin, etc.)
 */
async function handleUserDeleted(evt: WebhookEvent) {
  if (evt.type !== "user.deleted") return;

  const { id: clerkId } = evt.data;

  // Delete user from database (cascade delete handles related records)
  const deletedUser = await prisma.user.delete({
    where: { clerkId },
  });

  console.log(`User deleted from database:`, {
    id: deletedUser.id,
    clerkId: deletedUser.clerkId,
    email: deletedUser.email,
  });
}
