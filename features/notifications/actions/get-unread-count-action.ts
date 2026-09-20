"use server";

import { getUnreadCount } from "../queries/get-unread-count";
import { AuthenticationError, AuthorizationError, requireAuth } from "@/lib/auth";

/**
 * Server action to fetch unread notification count for authenticated user
 * 
 * @returns Unread count or error
 */
export async function getUnreadCountAction() {
  try {
    // Authorization: Authenticated user only
    const user = await requireAuth();

    // Fetch unread count
    const count = await getUnreadCount(user.id);

    return {
      success: true,
      count,
    };
  } catch (error) {
    console.error("Failed to fetch unread count:", error);

    // Recognised by type rather than by the words in a message.
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        success: false,
        error: "You must be signed in to view notifications.",
        count: 0,
      };
    }

    return {
      success: false,
      error: "Failed to load notification count.",
      count: 0,
    };
  }
}
