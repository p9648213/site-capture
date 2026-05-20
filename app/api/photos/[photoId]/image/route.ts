import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { parsePositiveIntParam, type RouteParams } from "@/lib/params";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = {
  params: RouteParams<"photoId">;
};

function getContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".png") {
    return "image/png";
  }

  return "image/jpeg";
}

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedPhotoId = await parsePositiveIntParam(params, "photoId");

  if (parsedPhotoId.error) {
    return parsedPhotoId.error;
  }

  const photo = await prisma.photo.findUnique({
    where: { id: parsedPhotoId.value },
    select: { serverFilePath: true },
  });

  if (!photo) {
    return apiError(404, "NOT_FOUND", "Photo not found");
  }

  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const absoluteFilePath = path.resolve(process.cwd(), photo.serverFilePath.replace(/^\/+/, ""));
  const relativeToUploads = path.relative(uploadsRoot, absoluteFilePath);

  if (relativeToUploads.startsWith("..") || path.isAbsolute(relativeToUploads)) {
    return apiError(400, "BAD_REQUEST", "Invalid photo path");
  }

  const file = await fs.readFile(absoluteFilePath).catch(() => null);

  if (!file) {
    return apiError(404, "NOT_FOUND", "Photo file not found");
  }

  return new Response(file, {
    headers: {
      "Content-Type": getContentType(photo.serverFilePath),
      "Cache-Control": "private, max-age=60",
    },
  });
}
