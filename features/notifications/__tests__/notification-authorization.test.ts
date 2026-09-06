import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNotifications } from "../queries/get-notifications";
import { markNotificationRead } from "../actions/mark-notification-read";
import { markAllNotificationsRead } from "../actions/mark-all-notifications-read";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

// Mock Clerk auth
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(() => ({
    users: {
      getUser: vi.fn(),
      updateUserMetadata: vi.fn(),
    },
  })),
}));

describe("Notification Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Get Notifications", () => {
    it("should return only user's own notifications", async () => {
      // Arrange
      const userId = "user123";
      const mockNotifications = [
        {
          id: "notif1",
          userId: "user123",
          type: "APPLICATION",
          title: "Test 1",
          message: "Message 1",
          resourceType: null,
          resourceId: null,
          isRead: false,
          createdAt: new Date(),
        },
        {
          id: "notif2",
          userId: "user123",
          type: "DRIVE",
          title: "Test 2",
          message: "Message 2",
          resourceType: null,
          resourceId: null,
          isRead: true,
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.notification.count).mockResolvedValue(2);
      vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications as any);

      // Act
      const result = await getNotifications(userId, { page: 1, pageSize: 25 });

      // Assert
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user123" },
        skip: 0,
        take: 25,
        orderBy: { createdAt: "desc" },
      });
      expect(result.data).toHaveLength(2);
      expect(result.data.every(n => n.userId === userId)).toBe(true);
    });

    it("should not return another user's notifications", async () => {
      // Arrange
      const userId = "user123";
      const otherUserNotification = {
        id: "notif1",
        userId: "otherUser",
        type: "APPLICATION",
        title: "Other User Notification",
        message: "Should not be returned",
        resourceType: null,
        resourceId: null,
        isRead: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.notification.count).mockResolvedValue(0);
      vi.mocked(prisma.notification.findMany).mockResolvedValue([]);

      // Act
      const result = await getNotifications(userId, { page: 1, pageSize: 25 });

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.data).not.toContainEqual(expect.objectContaining({
        userId: "otherUser",
      }));
    });
  });

  describe("Mark Notification as Read", () => {
    it("should reject marking another user's notification", async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue({ userId: "clerk123" } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user123",
        clerkId: "clerk123",
        email: "test@test.com",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notification.findUnique).mockResolvedValue({
        id: "notif1",
        userId: "otherUser",
        isRead: false,
      } as any);

      // Act
      const result = await markNotificationRead("notif1");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("permission");
      }
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it("should allow marking own notification as read", async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue({ userId: "clerk123" } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user123",
        clerkId: "clerk123",
        email: "test@test.com",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notification.findUnique).mockResolvedValue({
        id: "notif1",
        userId: "user123",
        isRead: false,
      } as any);

      vi.mocked(prisma.notification.update).mockResolvedValue({} as any);

      // Act
      const result = await markNotificationRead("notif1");

      // Assert
      expect(result.success).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notif1" },
        data: { isRead: true },
      });
    });

    it("should reject unauthenticated requests", async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      // Act
      const result = await markNotificationRead("notif1");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("signed in");
      }
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe("Mark All Notifications as Read", () => {
    it("should only mark user's own notifications", async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue({ userId: "clerk123" } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user123",
        clerkId: "clerk123",
        email: "test@test.com",
        role: "STUDENT",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 } as any);

      // Act
      const result = await markAllNotificationsRead();

      // Assert
      expect(result.success).toBe(true);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user123",
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
    });
  });
});
