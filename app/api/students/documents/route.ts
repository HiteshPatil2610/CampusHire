import { NextRequest, NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import {
  DOCUMENT_KINDS,
  uploadStudentDocument,
  type DocumentKind,
} from "@/lib/blob";

/**
 * POST /api/students/documents
 *
 * Uploads a supporting profile document (marksheet, grade card, internship
 * certificate) to Vercel Blob. The student is resolved from the session, so a
 * caller can only ever write into their own folder.
 */
export async function POST(request: NextRequest) {
  try {
    const { student } = await requireStudent();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kind = formData.get("kind");

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (
      typeof kind !== "string" ||
      !DOCUMENT_KINDS.includes(kind as DocumentKind)
    ) {
      return NextResponse.json(
        { success: false, error: "Unknown document type" },
        { status: 400 }
      );
    }

    const result = await uploadStudentDocument(
      file,
      student.id,
      kind as DocumentKind
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    console.error("Student document upload API error:", error);

    if (error instanceof Error && error.name === "AuthorizationError") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
