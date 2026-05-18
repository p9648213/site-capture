import { apiError } from "@/lib/http";

export type RouteParams<T extends string> = Promise<Record<T, string>>;

export async function parsePositiveIntParam<T extends string>(
  params: RouteParams<T>,
  key: T,
) {
  const value = (await params)[key];
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      error: apiError(400, "BAD_REQUEST", `Invalid ${key}`),
      value: null,
    } as const;
  }

  return {
    error: null,
    value: parsed,
  } as const;
}
