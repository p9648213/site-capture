import { API_BASE_URL, MOBILE_API_KEY, assertApiConfig } from "./config";
import type { SyncResponse } from "../types/site";

export async function fetchSitesForSync(): Promise<SyncResponse> {
  assertApiConfig();

  const response = await fetch(`${API_BASE_URL}/api/sites/sync`, {
    headers: {
      "x-api-key": MOBILE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Site sync failed with status ${response.status}`);
  }

  return (await response.json()) as SyncResponse;
}
