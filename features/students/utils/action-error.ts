import { ZodError } from "zod";

/**
 * The message a profile action returns for a failure. A validation failure
 * becomes its first issue's sentence ("End date cannot be before the start
 * date") — a ZodError's own `message` is a JSON dump of every issue, which is
 * what students used to see in the toast.
 */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
