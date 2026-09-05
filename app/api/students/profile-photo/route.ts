import { NextRequest, NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import { uploadProfilePhoto } from "@/lib/blob";

/**
 * POST /api/students/profile-photo
 * Upload profile photo to Vercel Blob
 * Requires authentication and STUDENT role
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get student
    const { student } = await requireStudent();

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const result = await uploadProfilePhoto(file, student.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Return the Blob URL
    return NextResponse.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error("Profile photo upload API error:", error);

    if (error instanceof Error && error.name === "AuthorizationError") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.name === "AuthenticationError") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to upload photo" },
      { status: 500 }
    );
  }
}
