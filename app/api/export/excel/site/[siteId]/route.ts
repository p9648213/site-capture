import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { imageSize } from "image-size";
import { requireAdmin } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { parsePositiveIntParam, type RouteParams } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { resolveStoredPhotoPath } from "@/lib/uploads";

export const runtime = "nodejs";

type Params = {
  params: RouteParams<"siteId">;
};

const fixedImageWidth = 400;
const excelPointsPerPixel = 0.75;

function sanitizeSheetName(name: string, fallback: string) {
  const sanitized = name.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim();
  return (sanitized || fallback).slice(0, 31);
}

function getImageExtension(filePath: string): "jpeg" | "png" {
  return path.extname(filePath).toLowerCase() === ".png" ? "png" : "jpeg";
}

function getDownloadFileName(siteName: string) {
  const safeName = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${safeName || "site"}-photos.xlsx`;
}

export async function GET(_request: Request, { params }: Params) {
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
            include: {
              photos: {
                orderBy: { capturedAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!site) {
    return apiError(404, "NOT_FOUND", "Site not found");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SiteCapture";
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const [categoryIndex, category] of site.categories.entries()) {
    const worksheet = workbook.addWorksheet(
      sanitizeSheetName(category.name, `Category ${categoryIndex + 1}`),
      {
        properties: {
          defaultColWidth: 18,
        },
      },
    );

    worksheet.columns = [
      { key: "label", width: 58 },
      { key: "details", width: 24 },
    ];

    worksheet.getCell("A1").value = site.name;
    worksheet.getCell("A1").font = { bold: true, size: 16 };
    worksheet.getCell("A2").value = category.name;
    worksheet.getCell("A2").font = { bold: true, size: 13 };
    worksheet.getCell("A3").value = site.address;
    worksheet.getCell("A3").font = { color: { argb: "FF526171" } };

    let currentRow = 5;

    for (const pictureType of category.pictureTypes) {
      const labelCell = worksheet.getCell(currentRow, 1);
      labelCell.value = pictureType.name;
      labelCell.font = { bold: true };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFF6FF" },
      };
      labelCell.border = {
        top: { style: "thin", color: { argb: "FFD9E2EC" } },
        left: { style: "thin", color: { argb: "FFD9E2EC" } },
        bottom: { style: "thin", color: { argb: "FFD9E2EC" } },
        right: { style: "thin", color: { argb: "FFD9E2EC" } },
      };
      worksheet.getRow(currentRow).height = 22;
      currentRow += 1;

      if (pictureType.photos.length === 0) {
        worksheet.getCell(currentRow, 1).value = "No photo uploaded";
        worksheet.getCell(currentRow, 1).font = { italic: true, color: { argb: "FF92400E" } };
        currentRow += 2;
        continue;
      }

      for (const photo of pictureType.photos) {
        const absolutePhotoPath = resolveStoredPhotoPath(photo.serverFilePath);

        if (!absolutePhotoPath) {
          worksheet.getCell(currentRow, 1).value = `Invalid image path: ${photo.serverFilePath}`;
          worksheet.getCell(currentRow, 1).font = { italic: true, color: { argb: "FF991B1B" } };
          currentRow += 2;
          continue;
        }

        const buffer = await fs.readFile(absolutePhotoPath).catch(() => null);

        if (!buffer) {
          worksheet.getCell(currentRow, 1).value = `Image file missing: ${photo.serverFilePath}`;
          worksheet.getCell(currentRow, 1).font = { italic: true, color: { argb: "FF991B1B" } };
          currentRow += 2;
          continue;
        }

        const dimensions = imageSize(buffer);

        if (!dimensions.width || !dimensions.height) {
          worksheet.getCell(currentRow, 1).value = `Could not read image dimensions: ${photo.serverFilePath}`;
          worksheet.getCell(currentRow, 1).font = { italic: true, color: { argb: "FF991B1B" } };
          currentRow += 2;
          continue;
        }

        const calculatedHeight = (dimensions.height / dimensions.width) * fixedImageWidth;
        const imageId = workbook.addImage({
          filename: absolutePhotoPath,
          extension: getImageExtension(absolutePhotoPath),
        });

        worksheet.getRow(currentRow).height = calculatedHeight * excelPointsPerPixel;
        worksheet.addImage(imageId, {
          tl: { col: 0, row: currentRow - 1 },
          ext: { width: fixedImageWidth, height: calculatedHeight },
          editAs: "oneCell",
        });

        worksheet.getCell(currentRow, 2).value = `Captured ${photo.capturedAt.toISOString()}`;
        worksheet.getCell(currentRow, 2).font = { color: { argb: "FF526171" }, size: 10 };

        currentRow += Math.max(2, Math.ceil(calculatedHeight / 45));
      }

      currentRow += 1;
    }
  }

  if (workbook.worksheets.length === 0) {
    const worksheet = workbook.addWorksheet("Site");
    worksheet.getCell("A1").value = site.name;
    worksheet.getCell("A2").value = "No categories configured";
  }

  const workbookBuffer = await workbook.xlsx.writeBuffer();

  return new Response(workbookBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${getDownloadFileName(site.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
