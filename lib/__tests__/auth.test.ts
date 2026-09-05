/**
 * Authentication & Authorization Tests
 * 
 * Tests for Unit 03 — Authentication & Role Synchronization
 * Tests auth helpers in lib/auth.ts
 * 
 * Note: These tests mock Clerk and Prisma to test business logic
 * without requiring actual Clerk account or database
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuthenticationError,
  AuthorizationError,
  getAuthUserId,
  requireAuth,
  requireRole,
  requireAnyRole,
  hasRole,
  hasAnyRole,
  canAccessDepartment,
  requireDepartmentAccess,
} from '../auth';
import type { User, Role } from '@prisma/client';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(() => ({
    users: {
      getUser: vi.fn(),
      updateUserMetadata: vi.fn(),
    },
  })),
}));

// Mock Prisma
vi.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    departmentAdmin: {
      findUnique: vi.fn(),
    },
    student: {
      findUnique: vi.fn(),
    },
  },
}));

// Import mocked modules
import { auth } from '@clerk/nextjs/server';
import { prisma } from '../prisma';

describe('Authentication Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthUserId', () => {
    it('should return userId when authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: 'clerk_user_123',
      } as any);

      const userId = await getAuthUserId();
      expect(userId).toBe('clerk_user_123');
    });

    it('should return null when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({
        userId: null,
      } as any);

      const userId = await getAuthUserId();
      expect(userId).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const user = await requireAuth();
      expect(user).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { clerkId: 'clerk_user_123' },
      });
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      await expect(requireAuth()).rejects.toThrow(AuthenticationError);
      await expect(requireAuth()).rejects.toThrow('You must be signed in');
    });

    it('should throw AuthenticationError when user not found in database', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      // Mock clerkClient to fail user creation
      const { clerkClient } = await import('@clerk/nextjs/server');
      vi.mocked(clerkClient).mockResolvedValue({
        users: {
          getUser: vi.fn().mockRejectedValue(new Error('User not found in Clerk')),
        },
      } as any);

      await expect(requireAuth()).rejects.toThrow(AuthenticationError);
    });
  });
});

describe('Role Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireRole', () => {
    it('should return user when role matches', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const user = await requireRole('STUDENT');
      expect(user).toEqual(mockUser);
    });

    it('should throw AuthorizationError when role does not match', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      await expect(requireRole('DEPT_ADMIN')).rejects.toThrow(AuthorizationError);
      await expect(requireRole('DEPT_ADMIN')).rejects.toThrow('requires DEPT_ADMIN role');
    });

    it('should throw AuthenticationError when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      await expect(requireRole('STUDENT')).rejects.toThrow(AuthenticationError);
    });
  });

  describe('requireAnyRole', () => {
    it('should return user when role is in allowed list', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'admin@college.edu',
        role: 'DEPT_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const user = await requireAnyRole(['DEPT_ADMIN', 'SUPER_ADMIN']);
      expect(user).toEqual(mockUser);
    });

    it('should throw AuthorizationError when role not in allowed list', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      await expect(requireAnyRole(['DEPT_ADMIN', 'SUPER_ADMIN'])).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('hasRole', () => {
    it('should return true when user has role', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await hasRole('STUDENT');
      expect(result).toBe(true);
    });

    it('should return false when user does not have role', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await hasRole('DEPT_ADMIN');
      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const result = await hasRole('STUDENT');
      expect(result).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true when user has any of the roles', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'admin@college.edu',
        role: 'DEPT_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await hasAnyRole(['DEPT_ADMIN', 'SUPER_ADMIN']);
      expect(result).toBe(true);
    });

    it('should return false when user does not have any of the roles', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const result = await hasAnyRole(['DEPT_ADMIN', 'SUPER_ADMIN']);
      expect(result).toBe(false);
    });
  });
});

describe('Department Scope Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canAccessDepartment', () => {
    it('should return true for SUPER_ADMIN accessing any department', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'superadmin@college.edu',
        role: 'SUPER_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      const canAccess = await canAccessDepartment('dept_123');
      expect(canAccess).toBe(true);
    });

    it('should return true for DEPT_ADMIN accessing own department', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'admin@college.edu',
        role: 'DEPT_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAdmin = {
        id: 'admin_123',
        userId: 'user_123',
        departmentId: 'dept_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(mockAdmin);

      const canAccess = await canAccessDepartment('dept_123');
      expect(canAccess).toBe(true);
    });

    it('should return false for DEPT_ADMIN accessing different department', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'admin@college.edu',
        role: 'DEPT_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAdmin = {
        id: 'admin_123',
        userId: 'user_123',
        departmentId: 'dept_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(mockAdmin);

      const canAccess = await canAccessDepartment('dept_456'); // Different department
      expect(canAccess).toBe(false);
    });

    it('should return true for STUDENT accessing own department', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStudent = {
        id: 'student_123',
        userId: 'user_123',
        departmentId: 'dept_123',
        rollNumber: 'CS2021001',
        name: 'John Doe',
        phoneNumber: null,
        profilePhotoUrl: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent);

      const canAccess = await canAccessDepartment('dept_123');
      expect(canAccess).toBe(true);
    });

    it('should return false for STUDENT accessing different department', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'student@college.edu',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStudent = {
        id: 'student_123',
        userId: 'user_123',
        departmentId: 'dept_123',
        rollNumber: 'CS2021001',
        name: 'John Doe',
        phoneNumber: null,
        profilePhotoUrl: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.student.findUnique).mockResolvedValue(mockStudent);

      const canAccess = await canAccessDepartment('dept_456'); // Different department
      expect(canAccess).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const canAccess = await canAccessDepartment('dept_123');
      expect(canAccess).toBe(false);
    });
  });

  describe('requireDepartmentAccess', () => {
    it('should not throw when user can access department', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'superadmin@college.edu',
        role: 'SUPER_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);

      await expect(requireDepartmentAccess('dept_123')).resolves.toBeUndefined();
    });

    it('should throw AuthorizationError when user cannot access department', async () => {
      const mockUser: User = {
        id: 'user_123',
        clerkId: 'clerk_user_123',
        email: 'admin@college.edu',
        role: 'DEPT_ADMIN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAdmin = {
        id: 'admin_123',
        userId: 'user_123',
        departmentId: 'dept_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_user_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.departmentAdmin.findUnique).mockResolvedValue(mockAdmin);

      await expect(requireDepartmentAccess('dept_456')).rejects.toThrow(
        AuthorizationError
      );
      await expect(requireDepartmentAccess('dept_456')).rejects.toThrow(
        'do not have permission to access this department'
      );
    });
  });
});

describe('Error Classes', () => {
  it('should create AuthenticationError with default message', () => {
    const error = new AuthenticationError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AuthenticationError');
    expect(error.message).toBe('Authentication required');
  });

  it('should create AuthenticationError with custom message', () => {
    const error = new AuthenticationError('Custom auth error');
    expect(error.message).toBe('Custom auth error');
  });

  it('should create AuthorizationError with default message', () => {
    const error = new AuthorizationError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AuthorizationError');
    expect(error.message).toBe('Insufficient permissions');
  });

  it('should create AuthorizationError with custom message', () => {
    const error = new AuthorizationError('Custom authorization error');
    expect(error.message).toBe('Custom authorization error');
  });
});
