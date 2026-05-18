export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
export const MOBILE_API_KEY = process.env.EXPO_PUBLIC_MOBILE_API_KEY ?? "";

export function assertApiConfig() {
  if (!MOBILE_API_KEY) {
    throw new Error("EXPO_PUBLIC_MOBILE_API_KEY is not configured.");
  }
}
