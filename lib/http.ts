import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function validationError(error: ZodError) {
  return apiError(400, "BAD_REQUEST", "Invalid request body", error.flatten());
}
