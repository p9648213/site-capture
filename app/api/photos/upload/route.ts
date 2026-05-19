import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireMobileApiKey } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { cascadeStatusesAfterPhotoUpload } from "@/lib/status-cascade";
import { buildStoredPhotoPath, getSupportedImageExtension } from "@/lib/uploads";

export const runtime = "nodejs";

function readRequiredInt(form: FormData, key: string) {
  const value = form.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readOptionalNumber(form: FormData, key: string) {
  const value = form.get(key);

  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readOptionalString(form: FormData, key: string) {
  const value = form.get(key);

  if (value === null || value === "") {
    return null;
  }

  return typeof value === "string" ? value : undefined;
}

function readCapturedAt(form: FormData) {
  const value = form.get("capturedAt");

  if (typeof value !== "string") {
    return null;
  }

  const capturedAt = new Date(value);
  return Number.isNaN(capturedAt.getTime()) ? null : capturedAt;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireMobileApiKey(request);

  if (unauthorized) {
    return unauthorized;
  }

  const form = await request.formData();
  const siteId = readRequiredInt(form, "siteId");
  const categoryId = readRequiredInt(form, "categoryId");
  const pictureTypeId = readRequiredInt(form, "pictureTypeId");
  const latitude = readOptionalNumber(form, "latitude");
  const longitude = readOptionalNumber(form, "longitude");
  const localUri = readOptionalString(form, "localUri");
  const capturedAt = readCapturedAt(form);
  const file = form.get("file");

  if (!siteId || !categoryId || !pictureTypeId || !capturedAt) {
    return apiError(
      400,
      "BAD_REQUEST",
      "siteId, categoryId, pictureTypeId, and capturedAt are required",
    );
  }

  if (latitude === undefined || longitude === undefined || localUri === undefined) {
    return apiError(400, "BAD_REQUEST", "Invalid optional photo metadata");
  }

  if (!(file instanceof File)) {
    return apiError(400, "BAD_REQUEST", "A file field is required");
  }

  const extension = getSupportedImageExtension(file);

  if (!extension) {
    return apiError(400, "BAD_REQUEST", "Only JPG and PNG images are supported");
  }

  const pictureType = await prisma.pictureType.findFirst({
    where: {
      id: pictureTypeId,
      category: {
        id: categoryId,
        siteId,
      },
    },
    select: { id: true },
  });

  if (!pictureType) {
    return apiError(404, "NOT_FOUND", "Picture type was not found for this site/category");
  }

  const relativeFilePath = buildStoredPhotoPath({
    siteId,
    categoryId,
    pictureTypeId,
    photoId: crypto.randomUUID(),
    extension,
  });
  const absoluteFilePath = path.resolve(process.cwd(), relativeFilePath);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
  await fs.writeFile(absoluteFilePath, fileBuffer);

  const photo = await prisma.$transaction(async (tx) => {
    const createdPhoto = await tx.photo.create({
      data: {
        pictureTypeId,
        localUri,
        serverFilePath: `/${relativeFilePath}`,
        latitude,
        longitude,
        capturedAt,
      },
    });

    await cascadeStatusesAfterPhotoUpload(tx, {
      siteId,
      categoryId,
      pictureTypeId,
    });

    return createdPhoto;
  });

  return NextResponse.json({
    photo: {
      id: photo.id,
      pictureTypeId: photo.pictureTypeId,
      serverFilePath: photo.serverFilePath,
      latitude: photo.latitude?.toString() ?? null,
      longitude: photo.longitude?.toString() ?? null,
      capturedAt: photo.capturedAt.toISOString(),
    },
    server_photo_id: photo.id,
  });
}
