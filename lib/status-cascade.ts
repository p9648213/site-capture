import { Status, type Prisma } from "@prisma/client";

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
      data: { status: Status.COMPLETED },
    });
  } else {
    await tx.category.update({
      where: { id: input.categoryId },
      data: { status: Status.INCOMPLETE },
    });
  }

  const incompleteCategories = await tx.category.count({
    where: {
      siteId: input.siteId,
      status: Status.INCOMPLETE,
    },
  });

  if (incompleteCategories === 0) {
    await tx.site.update({
      where: { id: input.siteId },
      data: { status: Status.COMPLETED },
    });
  } else {
    await tx.site.update({
      where: { id: input.siteId },
      data: { status: Status.INCOMPLETE },
    });
  }
}
