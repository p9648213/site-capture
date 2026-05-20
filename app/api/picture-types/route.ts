import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createPictureTypeSchema } from "@/lib/schemas";
import { markCategoryAndSiteIncomplete } from "@/lib/status-cascade";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createPictureTypeSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const pictureType = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUniqueOrThrow({
      where: { id: parsed.data.categoryId },
      select: { siteId: true },
    });
    const lastPictureType = await tx.pictureType.findFirst({
      where: { categoryId: parsed.data.categoryId },
      orderBy: [{ sortOrder: "desc" }, { id: "desc" }],
      select: { sortOrder: true },
    });
    const createdPictureType = await tx.pictureType.create({
      data: {
        ...parsed.data,
        sortOrder: (lastPictureType?.sortOrder ?? 0) + 1,
      },
    });

    await markCategoryAndSiteIncomplete(tx, {
      categoryId: parsed.data.categoryId,
      siteId: category.siteId,
    });

    return createdPictureType;
  });

  return NextResponse.json({ pictureType }, { status: 201 });
}
