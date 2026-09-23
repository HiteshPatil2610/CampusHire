import { NextRequest, NextResponse } from "next/server";
import { getActiveDepartmentAdmin, getCurrentUser } from "@/lib/auth";
import { uploadCompanyLogo } from "@/lib/blob";

/**
 * POST /api/admin/drives/logo
 *
 * Uploads a recruiting company's logo for a drive. Both department admins and
 * the super admin post drives, so both roles may upload; the storage path is
 * derived from the caller's own user id and never from the request.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "DEPT_ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // A department admin must still hold their department: a revoked admin's
    // role alone uploads nothing.
    if (user.role === "DEPT_ADMIN" && !(await getActiveDepartmentAdmin(user.id))) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const result = await uploadCompanyLogo(file, user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error("Company logo upload API error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
