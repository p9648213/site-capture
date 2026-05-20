import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { parsePositiveIntParam, type RouteParams } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { reorderPictureTypesSchema } from "@/lib/schemas";

type Params = {
  params: RouteParams<"categoryId">;
};

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedCategoryId = await parsePositiveIntParam(params, "categoryId");

  if (parsedCategoryId.error) {
    return parsedCategoryId.error;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = reorderPictureTypesSchema.safeParse(body);

  if (!parsedBody.success) {
    return validationError(parsedBody.error);
  }

  const uniqueIds = new Set(parsedBody.data.pictureTypeIds);

  if (uniqueIds.size !== parsedBody.data.pictureTypeIds.length) {
    return apiError(400, "BAD_REQUEST", "Picture type ids must be unique");
  }

  const result = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: parsedCategoryId.value },
      select: { id: true },
    });

    if (!category) {
      return null;
    }

    const currentPictureTypes = await tx.pictureType.findMany({
      where: { categoryId: parsedCategoryId.value },
      select: { id: true },
    });
    const currentIds = new Set(currentPictureTypes.map((pictureType) => pictureType.id));

    if (
      currentIds.size !== parsedBody.data.pictureTypeIds.length ||
      parsedBody.data.pictureTypeIds.some((pictureTypeId) => !currentIds.has(pictureTypeId))
    ) {
      return { ok: false as const };
    }

    for (const [index, pictureTypeId] of parsedBody.data.pictureTypeIds.entries()) {
      await tx.pictureType.update({
        where: { id: pictureTypeId },
        data: { sortOrder: index + 1 },
      });
    }

    return { ok: true as const };
  });

  if (!result) {
    return apiError(404, "NOT_FOUND", "Category not found");
  }

  if (!result.ok) {
    return apiError(400, "BAD_REQUEST", "Order must include every picture type in this category");
  }

  return NextResponse.json(result);
}
