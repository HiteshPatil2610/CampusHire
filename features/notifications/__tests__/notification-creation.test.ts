import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotification, NotificationType } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

describe("Notification Creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create notification for valid user", async () => {
    // Arrange
    const mockUser = { id: "user123" };
    const mockNotification = {
      id: "notif123",
      userId: "user123",
      type: NotificationType.APPLICATION,
      title: "Application Submitted",
      message: "You applied to Google",
      resourceType: "Drive",
      resourceId: "drive123",
      isRead: false,
      createdAt: new Date(),
    };

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.notification.create).mockResolvedValue(mockNotification as any);

    // Act
    await createNotification({
      userId: "user123",
      type: NotificationType.APPLICATION,
      title: "Application Submitted",
      message: "You applied to Google",
      resourceType: "Drive",
      resourceId: "drive123",
    });

    // Assert
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user123" },
      select: { id: true },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user123",
        type: NotificationType.APPLICATION,
        title: "Application Submitted",
        message: "You applied to Google",
        resourceType: "Drive",
        resourceId: "drive123",
        isRead: false,
      },
    });
  });

  it("should not create notification for non-existent user", async () => {
    // Arrange
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    await createNotification({
      userId: "invalid-user",
      type: NotificationType.APPLICATION,
      title: "Test",
      message: "Test message",
    });

    // Assert
    expect(prisma.user.findUnique).toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("User not found")
    );

    consoleSpy.mockRestore();
  });

  it("should sanitize long titles", async () => {
    // Arrange
    const mockUser = { id: "user123" };
    const longTitle = "A".repeat(600);
    
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    // Act
    await createNotification({
      userId: "user123",
      type: NotificationType.SYSTEM,
      title: longTitle,
      message: "Test",
    });

    // Assert
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: expect.stringMatching(/^A{500}\.\.\.$/),
      }),
    });
  });

  it("should trim whitespace from title and message", async () => {
    // Arrange
    const mockUser = { id: "user123" };
    
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any);

    // Act
    await createNotification({
      userId: "user123",
      type: NotificationType.PROFILE,
      title: "  Test   Title  ",
      message: "  Test   Message  ",
    });

    // Assert
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Test Title",
        message: "Test Message",
      }),
    });
  });

  it("should handle errors gracefully without throwing", async () => {
    // Arrange
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("Database error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act & Assert - should not throw
    await expect(
      createNotification({
        userId: "user123",
        type: NotificationType.SYSTEM,
        title: "Test",
        message: "Test",
      })
    ).resolves.not.toThrow();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
