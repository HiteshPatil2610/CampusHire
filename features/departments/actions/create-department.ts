"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import {
  createDepartmentSchema,
  type CreateDepartmentInput,
} from "../schemas/department";
import { Prisma } from "@prisma/client";

/**
 * Create a new department
 * 
 * Authorization: SUPER_ADMIN only
 * 
 * @param input - Department creation data
 * @returns Created department or error
 */
export async function createDepartment(input: CreateDepartmentInput) {
  try {
    // Verify Super Admin authorization
    await requireSuperAdmin();

    // Validate input
    const validated = createDepartmentSchema.parse(input);

    // Create department
    const department = await prisma.department.create({
      data: {
        name: validated.name,
        code: validated.code,
        isActive: validated.isActive,
      },
    });

    // Revalidate departments page
    revalidatePath("/super-admin-dashboard/departments");

    return {
      success: true as const,
      data: department,
    };
  } catch (error) {
    console.error("Error creating department:", error);

    // Handle duplicate code error
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[]) || [];
      if (target.includes("code")) {
        return {
          success: false as const,
          error: `A department with code '${input.code}' already exists`,
        };
      }
    }

    // Handle validation errors
    if (error instanceof Error && error.name === "ZodError") {
      return {
        success: false as const,
        error: error.message,
      };
    }

    // Handle authorization errors
    if (
      error instanceof Error &&
      (error.name === "AuthenticationError" ||
        error.name === "AuthorizationError")
    ) {
      return {
        success: false as const,
        error: error.message,
      };
    }

    return {
      success: false as const,
      error: "Failed to create department. Please try again.",
    };
  }
}
