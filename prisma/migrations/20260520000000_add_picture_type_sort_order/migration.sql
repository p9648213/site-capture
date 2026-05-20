ALTER TABLE "PictureType" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "PictureType" SET "sortOrder" = "id";

CREATE INDEX "PictureType_categoryId_sortOrder_idx" ON "PictureType"("categoryId", "sortOrder");
