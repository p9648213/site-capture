import type { Prisma } from "@prisma/client";

const incompleteStatus = "INCOMPLETE";
const completedStatus = "COMPLETED";

export async function cascadeStatusesAfterPhotoUpload(
  tx: Prisma.TransactionClient,
  input: {
    siteId: number;
    categoryId: number;
    pictureTypeId: number;
  },
) {
  await tx.pictureType.update({
    where: { id: input.pictureTypeId },
    data: { isFulfilled: true },
  });

  const unfulfilledPictureTypes = await tx.pictureType.count({
    where: {
      categoryId: input.categoryId,
      isFulfilled: false,
    },
  });

  if (unfulfilledPictureTypes === 0) {
    await tx.category.update({
      where: { id: input.categoryId },
      data: { status: completedStatus },
    });
  } else {
    await tx.category.update({
      where: { id: input.categoryId },
      data: { status: incompleteStatus },
    });
  }

  const incompleteCategories = await tx.category.count({
    where: {
      siteId: input.siteId,
      status: incompleteStatus,
    },
  });

  if (incompleteCategories === 0) {
    await tx.site.update({
      where: { id: input.siteId },
      data: { status: completedStatus },
    });
  } else {
    await tx.site.update({
      where: { id: input.siteId },
      data: { status: incompleteStatus },
    });
  }
}
