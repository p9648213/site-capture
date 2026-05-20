import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { parsePositiveIntParam, type RouteParams } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { movePictureTypeSchema } from "@/lib/schemas";

type Params = {
  params: RouteParams<"pictureTypeId">;
};

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedPictureTypeId = await parsePositiveIntParam(params, "pictureTypeId");

  if (parsedPictureTypeId.error) {
    return parsedPictureTypeId.error;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = movePictureTypeSchema.safeParse(body);

  if (!parsedBody.success) {
    return validationError(parsedBody.error);
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.pictureType.findUnique({
      where: { id: parsedPictureTypeId.value },
      select: { id: true, categoryId: true },
    });

    if (!current) {
      return null;
    }

    const pictureTypes = await tx.pictureType.findMany({
      where: { categoryId: current.categoryId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const currentIndex = pictureTypes.findIndex((pictureType) => pictureType.id === current.id);
    const targetIndex = parsedBody.data.direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= pictureTypes.length) {
      return { moved: false };
    }

    const orderedIds = [...pictureTypes.map((pictureType) => pictureType.id)];
    const [movedId] = orderedIds.splice(currentIndex, 1);
    orderedIds.splice(targetIndex, 0, movedId);

    for (const [index, pictureTypeId] of orderedIds.entries()) {
      await tx.pictureType.update({
        where: { id: pictureTypeId },
        data: { sortOrder: index + 1 },
      });
    }

    return { moved: true };
  });

  if (!result) {
    return apiError(404, "NOT_FOUND", "Picture type not found");
  }

  return NextResponse.json(result);
}
