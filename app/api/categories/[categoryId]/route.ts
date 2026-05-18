import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { parsePositiveIntParam, type RouteParams } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { updateCategorySchema } from "@/lib/schemas";

type Params = {
  params: RouteParams<"categoryId">;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedCategoryId = await parsePositiveIntParam(params, "categoryId");

  if (parsedCategoryId.error) {
    return parsedCategoryId.error;
  }

  const category = await prisma.category.findUnique({
    where: { id: parsedCategoryId.value },
    include: {
      pictureTypes: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!category) {
    return apiError(404, "NOT_FOUND", "Category not found");
  }

  return NextResponse.json({ category });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedCategoryId = await parsePositiveIntParam(params, "categoryId");

  if (parsedCategoryId.error) {
    return parsedCategoryId.error;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = updateCategorySchema.safeParse(body);

  if (!parsedBody.success) {
    return validationError(parsedBody.error);
  }

  const category = await prisma.category.update({
    where: { id: parsedCategoryId.value },
    data: parsedBody.data,
  });

  return NextResponse.json({ category });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedCategoryId = await parsePositiveIntParam(params, "categoryId");

  if (parsedCategoryId.error) {
    return parsedCategoryId.error;
  }

  await prisma.category.delete({
    where: { id: parsedCategoryId.value },
  });

  return NextResponse.json({ ok: true });
}
