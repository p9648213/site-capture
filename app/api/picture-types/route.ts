import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createPictureTypeSchema } from "@/lib/schemas";

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

  const pictureType = await prisma.pictureType.create({
    data: parsed.data,
  });

  return NextResponse.json({ pictureType }, { status: 201 });
}
