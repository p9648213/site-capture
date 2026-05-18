import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, validationError } from "@/lib/http";
import { parsePositiveIntParam, type RouteParams } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { updateSiteSchema } from "@/lib/schemas";

type Params = {
  params: RouteParams<"siteId">;
};

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedSiteId = await parsePositiveIntParam(params, "siteId");

  if (parsedSiteId.error) {
    return parsedSiteId.error;
  }

  const site = await prisma.site.findUnique({
    where: { id: parsedSiteId.value },
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

  if (!site) {
    return apiError(404, "NOT_FOUND", "Site not found");
  }

  return NextResponse.json({ site });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedSiteId = await parsePositiveIntParam(params, "siteId");

  if (parsedSiteId.error) {
    return parsedSiteId.error;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsedBody = updateSiteSchema.safeParse(body);

  if (!parsedBody.success) {
    return validationError(parsedBody.error);
  }

  const site = await prisma.site.update({
    where: { id: parsedSiteId.value },
    data: parsedBody.data,
  });

  return NextResponse.json({ site });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();

  if (unauthorized) {
    return unauthorized;
  }

  const parsedSiteId = await parsePositiveIntParam(params, "siteId");

  if (parsedSiteId.error) {
    return parsedSiteId.error;
  }

  await prisma.site.delete({
    where: { id: parsedSiteId.value },
  });

  return NextResponse.json({ ok: true });
}
