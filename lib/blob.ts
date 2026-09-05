import { put } from "@vercel/blob";
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
