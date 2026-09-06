"use server";

import { getUnreadCount } from "../queries/get-unread-count";
import { requireAuth } from "@/lib/auth";

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
  } catch (error: any) {
    console.error("Failed to fetch unread count:", error);
    
    // Handle authorization errors
    if (error.message?.includes("Unauthorized") || error.message?.includes("signed in")) {
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
