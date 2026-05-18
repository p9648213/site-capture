import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createSiteSchema } from "@/lib/schemas";

export async function GET() {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const sites = await prisma.site.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      categories: {
        orderBy: { id: "asc" },
        include: {
          pictureTypes: {
            orderBy: { id: "asc" },
          },
        },
      },
    },
  });

  return NextResponse.json({ sites });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createSiteSchema.safeParse(body);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const site = await prisma.site.create({
    data: parsed.data,
  });

  return NextResponse.json({ site }, { status: 201 });
}

export async function PUT() {
  return apiError(400, "BAD_REQUEST", "Use resource-specific routes for updates");
}
