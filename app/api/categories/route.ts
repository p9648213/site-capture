import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createCategorySchema } from "@/lib/schemas";
import { markSiteIncomplete } from "@/lib/status-cascade";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const category = await prisma.$transaction(async (tx) => {
    const createdCategory = await tx.category.create({
      data: parsed.data,
    });
    await markSiteIncomplete(tx, parsed.data.siteId);
    return createdCategory;
  });

  return NextResponse.json({ category }, { status: 201 });
}
