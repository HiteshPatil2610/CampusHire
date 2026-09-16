import { put, del } from "@vercel/blob";
import { env } from "./env";

/**
 * Allowed image MIME types for profile photos
 */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Maximum file size for profile photos (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * Maximum import file size: 5MB
 */
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Allowed import MIME types / extensions
 */
const ALLOWED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const ALLOWED_IMPORT_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',  // .xls
  'text/csv',
  'application/csv',
];

/**
 * Validate an image file for profile photo upload
 * 
 * @param file - File to validate
 * @returns Validation result
 */
export function validateProfilePhoto(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return {
      valid: false,
      error: "File type must be JPEG, PNG, or WebP",
    };
  }

  return { valid: true };
}

/**
 * Upload a profile photo to Vercel Blob
 * 
 * @param file - File to upload
 * @param studentId - Student ID for file naming
 * @returns Blob URL or error
 */
export async function uploadProfilePhoto(
  file: File,
  studentId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Check if Blob token is configured
    if (!env.BLOB_READ_WRITE_TOKEN) {
      return {
        success: false,
        error: "File upload is not configured. Please contact administrator.",
      };
    }

    // Validate file
    const validation = validateProfilePhoto(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `profile-photos/${studentId}-${timestamp}.${extension}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return {
      success: true,
      url: blob.url,
    };
  } catch (error) {
    console.error("Blob upload error:", error);
    return {
      success: false,
      error: "Failed to upload photo. Please try again.",
    };
  }
}

/**
 * Validate an import file (Excel or CSV).
 */
export function validateImportFile(
  file: File
): { valid: boolean; error?: string } {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { valid: false, error: `File exceeds 5MB limit.` };
  }
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file format. Upload .xlsx, .xls, or .csv only.`,
    };
  }
  return { valid: true };
}

/**
 * Upload an import file to Vercel Blob.
 * Returns the Blob URL reference (stored transiently).
 */
export async function uploadImportFile(
  file: File,
  adminId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      return { success: false, error: 'File storage not configured.' };
    }
    const timestamp = Date.now();
    const ext = file.name.split('.').pop() ?? 'xlsx';
    const filename = `imports/${adminId}-${timestamp}.${ext}`;
    const blob = await put(filename, file, {
      access: 'public',
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return { success: true, url: blob.url };
  } catch (error) {
    console.error('Import file upload error:', error);
    return { success: false, error: 'Failed to upload file.' };
  }
}

/**
 * Delete an import file from Vercel Blob after successful import.
 * Called in the SAME transaction/flow as the successful commit — not
 * as a separate background job.
 */
export async function deleteImportFile(url: string): Promise<void> {
  try {
    if (!env.BLOB_READ_WRITE_TOKEN) return;
    await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch (error) {
    // Log but don't throw — Blob cleanup failure should not fail the import
    console.error('Failed to delete import Blob file:', error);
  }
}

/**
 * Supporting documents a student attaches to their profile: marksheets,
 * semester grade cards, and internship certificates.
 */
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Maximum size for a profile document (5MB) */
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;

/** Document slots a student can upload into. */
export const DOCUMENT_KINDS = [
  "tenth-marksheet",
  "twelfth-marksheet",
  // Lateral-entry students submit a diploma in place of a 12th marksheet.
  "diploma-marksheet",
  "grade-card",
  "experience-certificate",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function validateStudentDocument(
  file: File
): { valid: boolean; error?: string } {
  if (file.size > MAX_DOCUMENT_SIZE) {
    return {
      valid: false,
      error: `File must be smaller than ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB`,
    };
  }

  if (
    !ALLOWED_DOCUMENT_TYPES.includes(
      file.type as (typeof ALLOWED_DOCUMENT_TYPES)[number]
    )
  ) {
    return { valid: false, error: "Upload a PDF, JPEG, PNG, or WebP file" };
  }

  return { valid: true };
}

/**
 * Upload a supporting profile document to Vercel Blob.
 *
 * The filename is derived server-side from the student id and document kind,
 * so a caller cannot choose where the file lands.
 */
export async function uploadStudentDocument(
  file: File,
  studentId: string,
  kind: DocumentKind
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      return {
        success: false,
        error: "File upload is not configured. Please contact administrator.",
      };
    }

    const validation = validateStudentDocument(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const filename = `student-documents/${studentId}/${kind}-${Date.now()}.${extension}`;

    const blob = await put(filename, file, {
      access: "public",
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return { success: true, url: blob.url };
  } catch (error) {
    console.error("Student document upload error:", error);
    return { success: false, error: "Failed to upload file. Please try again." };
  }
}

/**
 * Maximum size for a company logo (2MB). Logos render at ~48px, so anything
 * larger is a source image nobody trimmed.
 */
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

/** Logos are displayed inline, so SVG is excluded — it can carry script. */
const ALLOWED_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function validateCompanyLogo(
  file: File
): { valid: boolean; error?: string } {
  if (file.size > MAX_LOGO_SIZE) {
    return {
      valid: false,
      error: `Logo must be smaller than ${MAX_LOGO_SIZE / (1024 * 1024)}MB`,
    };
  }

  if (
    !ALLOWED_LOGO_TYPES.includes(
      file.type as (typeof ALLOWED_LOGO_TYPES)[number]
    )
  ) {
    return { valid: false, error: "Logo must be a JPEG, PNG, or WebP image" };
  }

  return { valid: true };
}

/**
 * Upload a recruiting company's logo to Vercel Blob.
 *
 * The filename is derived server-side from the uploading admin's id, so a
 * caller cannot choose where the file lands. The returned URL is what gets
 * stored in `Drive.companyLogoUrl`.
 */
export async function uploadCompanyLogo(
  file: File,
  adminUserId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!env.BLOB_READ_WRITE_TOKEN) {
      return {
        success: false,
        error: "File upload is not configured. Please contact administrator.",
      };
    }

    const validation = validateCompanyLogo(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const filename = `company-logos/${adminUserId}-${Date.now()}.${extension}`;

    const blob = await put(filename, file, {
      access: "public",
      token: env.BLOB_READ_WRITE_TOKEN,
    });

    return { success: true, url: blob.url };
  } catch (error) {
    console.error("Company logo upload error:", error);
    return { success: false, error: "Failed to upload logo. Please try again." };
  }
}
