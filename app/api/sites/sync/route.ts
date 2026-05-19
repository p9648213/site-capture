import { NextRequest, NextResponse } from "next/server";
import { requireMobileApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const unauthorized = requireMobileApiKey(request);

  if (unauthorized) {
    return unauthorized;
  }

  const sites = await prisma.site.findMany({
    orderBy: {
      updatedAt: "desc",
    },
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

  return NextResponse.json({
    syncedAt: new Date().toISOString(),
    sites,
  });
}
