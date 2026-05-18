import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { parsePositiveIntParam, type RouteParams } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { updatePictureTypeSchema } from "@/lib/schemas";

type Params = {
  params: RouteParams<"pictureTypeId">;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedPictureTypeId = await parsePositiveIntParam(params, "pictureTypeId");

  if (parsedPictureTypeId.error) {
    return parsedPictureTypeId.error;
  }

  const pictureType = await prisma.pictureType.findUnique({
    where: { id: parsedPictureTypeId.value },
    include: {
      photos: {
        orderBy: { capturedAt: "desc" },
      },
    },
  });

  if (!pictureType) {
    return apiError(404, "NOT_FOUND", "Picture type not found");
  }

  return NextResponse.json({ pictureType });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedPictureTypeId = await parsePositiveIntParam(params, "pictureTypeId");

  if (parsedPictureTypeId.error) {
    return parsedPictureTypeId.error;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = updatePictureTypeSchema.safeParse(body);

  if (!parsedBody.success) {
    return validationError(parsedBody.error);
  }

  const pictureType = await prisma.pictureType.update({
    where: { id: parsedPictureTypeId.value },
    data: parsedBody.data,
  });

  return NextResponse.json({ pictureType });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedPictureTypeId = await parsePositiveIntParam(params, "pictureTypeId");

  if (parsedPictureTypeId.error) {
    return parsedPictureTypeId.error;
  }

  await prisma.pictureType.delete({
    where: { id: parsedPictureTypeId.value },
  });

  return NextResponse.json({ ok: true });
}
