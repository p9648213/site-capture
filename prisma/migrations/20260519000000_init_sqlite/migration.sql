-- CreateTable
CREATE TABLE "Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PictureType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isFulfilled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PictureType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pictureTypeId" INTEGER NOT NULL,
    "localUri" TEXT,
    "serverFilePath" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "capturedAt" DATETIME NOT NULL,
    CONSTRAINT "Photo_pictureTypeId_fkey" FOREIGN KEY ("pictureTypeId") REFERENCES "PictureType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Site_status_idx" ON "Site"("status");

-- CreateIndex
CREATE INDEX "Category_siteId_idx" ON "Category"("siteId");

-- CreateIndex
CREATE INDEX "Category_status_idx" ON "Category"("status");

-- CreateIndex
CREATE INDEX "PictureType_categoryId_idx" ON "PictureType"("categoryId");

-- CreateIndex
CREATE INDEX "Photo_pictureTypeId_idx" ON "Photo"("pictureTypeId");
