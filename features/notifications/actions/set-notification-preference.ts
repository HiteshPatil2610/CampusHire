"use server";

import { revalidatePath } from "next/cache";
import type { NotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NOTIFICATION_EVENTS, optionalEventsFor } from "../domain/events";

export type PreferenceResult =
  | { success: true; muted: NotificationEvent[] }
  | { success: false; error: string };

/**
 * Turn one kind of notification on or off for the signed-in user.
 *
 * Only events the registry marks optional *for that user's role* can be
 * muted: an application outcome, an access decision, a cancelled drive or a
 * system alert is never silenced, and an URGENT announcement is delivered
 * whatever the preference says (`isSuppressedByPreference`).
 *
 * Authorization: the signed-in user, for their own preferences only.
 */
export async function setNotificationPreference(input: {
  event: string;
  enabled: boolean;
}): Promise<PreferenceResult> {
  try {
    const user = await requireAuth();

    const event = String(input.event) as NotificationEvent;
    if (!(event in NOTIFICATION_EVENTS)) {
      return { success: false, error: "Unknown notification type." };
    }
    if (!optionalEventsFor(user.role).includes(event)) {
      return { success: false, error: "This notification cannot be turned off." };
    }

    const existing = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
      select: { mutedEvents: true },
    });
    const current = new Set(existing?.mutedEvents ?? []);
    if (input.enabled === true) current.delete(event);
    else current.add(event);

    // Only events this role may mute survive, so a role change cannot leave
    // a stale mute behind.
    const allowed = new Set(optionalEventsFor(user.role));
    const muted = [...current].filter((value) => allowed.has(value));

    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, mutedEvents: muted },
      update: { mutedEvents: muted },
    });

    revalidatePath("/student-dashboard/settings");
    revalidatePath("/student-dashboard/notifications");
    revalidatePath("/admin-dashboard/notifications");
    revalidatePath("/super-admin-dashboard/notifications");

    return { success: true, muted };
  } catch (error) {
    console.error("setNotificationPreference error:", error);
    return { success: false, error: "Failed to save the preference. Please try again." };
  }
}

/** The signed-in user's muted events (empty when they have never set any). */
export async function getMyMutedEvents(): Promise<NotificationEvent[]> {
  const user = await requireAuth();
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
    select: { mutedEvents: true },
  });
  const allowed = new Set(optionalEventsFor(user.role));
  return (preference?.mutedEvents ?? []).filter((event) => allowed.has(event));
}
