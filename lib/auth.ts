import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/http";

const ADMIN_COOKIE = "sitecapture_admin";
const JWT_ISSUER = "sitecapture";
const JWT_AUDIENCE = "sitecapture-admin";

function getJwtSecret() {
  const secret = process.env.ADMIN_JWT_SECRET ?? process.env.ADMIN_PASSWORD;

  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET or ADMIN_PASSWORD must be set");
  }

  return new TextEncoder().encode(secret);
}

export function requireMobileApiKey(request: NextRequest) {
  const expectedApiKey = process.env.MOBILE_API_KEY;

  if (!expectedApiKey) {
    throw new Error("MOBILE_API_KEY must be set");
  }

  if (request.headers.get("x-api-key") !== expectedApiKey) {
    return apiError(401, "UNAUTHORIZED", "Invalid mobile API key");
  }

  return null;
}

export async function createAdminSessionToken() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getJwtSecret());
}

export async function requireAdmin() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return apiError(401, "UNAUTHORIZED", "Admin session required");
  }

  return null;
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!token) {
    return false;
  }

  try {
    await jwtVerify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}

export async function requireAdminOrMobileApiKey(request: NextRequest) {
  if (!request.headers.has("x-api-key")) {
    return requireAdmin();
  }

  const mobileUnauthorized = requireMobileApiKey(request);

  if (!mobileUnauthorized) {
    return null;
  }

  return requireAdmin();
}

export async function setAdminSessionCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
