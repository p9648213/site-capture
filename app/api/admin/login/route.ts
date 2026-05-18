import { NextRequest, NextResponse } from "next/server";
import { createAdminSessionToken, setAdminSessionCookie } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { adminLoginSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD must be set");
  }

  if (parsed.data.password !== adminPassword) {
    return apiError(401, "UNAUTHORIZED", "Invalid admin password");
  }

  const token = await createAdminSessionToken();
  await setAdminSessionCookie(token);

  return NextResponse.json({ ok: true });
}
