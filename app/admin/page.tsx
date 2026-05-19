import { redirect } from "next/navigation";
import { AdminDashboard } from "@/app/admin/admin-dashboard";
import type { AdminStatus } from "@/lib/admin/types";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AdminSite } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

function serializeSites(sites: Awaited<ReturnType<typeof getSites>>) {
  return sites.map(
    (site): AdminSite => ({
      id: site.id,
      name: site.name,
      address: site.address,
      status: site.status as AdminStatus,
      updatedAt: site.updatedAt.toISOString(),
      categories: site.categories.map((category) => ({
        id: category.id,
        siteId: category.siteId,
        name: category.name,
        status: category.status as AdminStatus,
        updatedAt: category.updatedAt.toISOString(),
        pictureTypes: category.pictureTypes.map((pictureType) => ({
          id: pictureType.id,
          categoryId: pictureType.categoryId,
          name: pictureType.name,
          isFulfilled: pictureType.isFulfilled,
          updatedAt: pictureType.updatedAt.toISOString(),
        })),
      })),
    }),
  );
}

async function getSites() {
  return prisma.site.findMany({
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
}

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const sites = serializeSites(await getSites());

  return <AdminDashboard initialSites={sites} />;
}
