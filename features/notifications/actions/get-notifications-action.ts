"use server";

import { getNotifications } from "../queries/get-notifications";
import { getNotificationsSchema } from "../schemas/notification";
import { requireAuth } from "@/lib/auth";

/**
 * Server action to fetch notifications for authenticated user
 * 
 * @param input - Query parameters with pagination and filters
 * @returns Paginated notification results or error
 */
export async function getNotificationsAction(input: {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}) {
  try {
    // Authorization: Authenticated user only
    const user = await requireAuth();

    // Parse and validate input
    const parsedInput = {
      page: input.page || 1,
      pageSize: input.pageSize || 25,
      isRead: input.isRead,
    };

    // Validate input
    const validated = getNotificationsSchema.parse(parsedInput);

    // Fetch notifications
    const result = await getNotifications(user.id, validated);

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    console.error("Failed to fetch notifications:", error);
    
    // Handle authorization errors
    if (error.message?.includes("Unauthorized") || error.message?.includes("signed in")) {
      return {
        success: false,
        error: "You must be signed in to view notifications.",
      };
    }

    return {
      success: false,
      error: "Failed to load notifications. Please try again.",
    };
  }
}
