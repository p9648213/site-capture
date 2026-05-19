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

type PhotoRecord = {
  serverFilePath: string;
};

// Adjusted width to roughly equal 3 merged columns (Cols A, B, C or E, F, G)
const fixedImageWidth = 390;
const excelPointsPerPixel = 0.75;

// Using Partial fixes the TS "diagonal missing" error
const borderStyle: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

// Safely generate a unique sheet name to prevent ExcelJS from crashing on duplicates
function getUniqueSheetName(name: string, fallback: string, existingNames: Set<string>) {
  let sanitized = name.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim();
  sanitized = (sanitized || fallback).slice(0, 31);

  let finalName = sanitized;
  let counter = 1;
  while (existingNames.has(finalName.toLowerCase())) {
    const suffix = ` (${counter})`;
    finalName = sanitized.slice(0, 31 - suffix.length) + suffix;
    counter++;
  }
  existingNames.add(finalName.toLowerCase());
  return finalName;
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

async function processAndAddImage(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  photo: PhotoRecord,
  colIndex: number,
  rowIndex: number,
  width: number
) {
  const absolutePhotoPath = resolveStoredPhotoPath(photo.serverFilePath);
  if (!absolutePhotoPath) return { error: "Invalid image path" };

  const buffer = await fs.readFile(absolutePhotoPath).catch(() => null);
  if (!buffer) return { error: "Image file missing" };

  const dimensions = imageSize(buffer);
  if (!dimensions.width || !dimensions.height) return { error: "Invalid dimensions" };

  const calculatedHeight = (dimensions.height / dimensions.width) * width;
  const imageId = workbook.addImage({
    filename: absolutePhotoPath,
    extension: getImageExtension(absolutePhotoPath),
  });

  worksheet.addImage(imageId, {
    tl: { col: colIndex, row: rowIndex },
    ext: { width: width, height: calculatedHeight },
    editAs: "oneCell",
  });

  return { height: calculatedHeight };
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

  const usedSheetNames = new Set<string>();

  // This loop will properly create a separate Sheet for EVERY category.
  for (const [categoryIndex, category] of site.categories.entries()) {
    const sheetName = getUniqueSheetName(category.name, `Category ${categoryIndex + 1}`, usedSheetNames);
    const worksheet = workbook.addWorksheet(sheetName);

    // Setup 7-Column Layout
    // Left Box: Cols A-C, Spacer: Col D, Right Box: Cols E-G
    worksheet.columns = [
      { key: "A", width: 18 },
      { key: "B", width: 3 },
      { key: "C", width: 32 },
      { key: "D", width: 3 }, // Gap Column
      { key: "E", width: 18 },
      { key: "F", width: 3 },
      { key: "G", width: 32 },
    ];

    // Page number watermark/footer for printing
    worksheet.headerFooter = { oddFooter: "&C&40&KCCCCCCPage &P" };

    // --- 1. TOP TITLE ---
    worksheet.mergeCells("A1:G1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = category.name.toUpperCase();
    titleCell.font = { name: "Times New Roman", size: 18, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 35;

    // --- 2. METADATA HEADER TABLE ---
    // Pre-apply formats and borders for the 3x7 grid before merges
    for (let r = 2; r <= 4; r++) {
      for (let c = 1; c <= 7; c++) {
        const cell = worksheet.getCell(r, c);
        cell.border = borderStyle;
        cell.font = { name: "Times New Roman", size: 11, bold: true };
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      }
    }

    // Row 2: Project Name
    worksheet.getCell("A2").value = "Tên Dự án";
    worksheet.getCell("B2").value = ":";
    worksheet.mergeCells("C2:G2");
    worksheet.getCell("C2").value = "RADIO NETWORK CAPACITY IMPROVEMENT FOR THE SOUTH 4 AREA AND NEIGHBORING OF MOBIFONE NETWORKS YEAR 2026";
    worksheet.getRow(2).height = 30;

    // Row 3: Contract Number
    worksheet.getCell("A3").value = "Số Hợp đồng";
    worksheet.getCell("B3").value = ":";
    worksheet.mergeCells("C3:G3");
    worksheet.getCell("C3").value = "TECH/TCT-903-26-MBF/EAB-ETV-HTKT CP-CTIN";
    worksheet.getRow(3).height = 20;

    // Row 4: Site Info
    worksheet.getCell("A4").value = "Site ID";
    worksheet.getCell("B4").value = ":";
    worksheet.mergeCells("C4:D4"); // Bridges the gap for the header
    worksheet.getCell("C4").value = site.name;
    worksheet.getCell("C4").alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getCell("E4").value = "Site Name";
    worksheet.getCell("F4").value = ":";
    worksheet.getCell("G4").value = site.name;
    worksheet.getCell("G4").alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(4).height = 20;

    // --- 3. SECTION TITLE ---
    let currentRow = 6;
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const secTitle = worksheet.getCell(`A${currentRow}`);
    secTitle.value = category.name.toUpperCase();
    secTitle.font = { name: "Times New Roman", size: 16, bold: true };
    secTitle.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow).height = 30;
    currentRow += 1;

    // Flatten photos into a single array to process in pairs
    const photosList: { label: string; photo: PhotoRecord }[] = [];
    for (const pt of category.pictureTypes) {
      for (const photo of pt.photos) {
        photosList.push({ label: pt.name, photo });
      }
    }

    if (photosList.length === 0) {
      worksheet.getCell(`A${currentRow}`).value = "No photo uploaded";
      worksheet.getCell(`A${currentRow}`).font = { italic: true, name: "Times New Roman" };
      continue;
    }

    // --- 4. PHOTO GRID (2 Column Layout) ---
    for (let i = 0; i < photosList.length; i += 2) {
      const leftItem = photosList[i];
      const rightItem = photosList[i + 1];

      // Format Labels Row
      [1, 2, 3].forEach((c) => (worksheet.getCell(currentRow, c).border = borderStyle));
      if (rightItem) {
        [5, 6, 7].forEach((c) => (worksheet.getCell(currentRow, c).border = borderStyle));
      }

      // Left Box Label
      worksheet.mergeCells(currentRow, 1, currentRow, 3); // A:C
      const leftLabel = worksheet.getCell(currentRow, 1);
      leftLabel.value = leftItem.label;
      leftLabel.font = { name: "Times New Roman", size: 12 };
      leftLabel.alignment = { horizontal: "center", vertical: "middle" };

      // Right Box Label
      if (rightItem) {
        worksheet.mergeCells(currentRow, 5, currentRow, 7); // E:G
        const rightLabel = worksheet.getCell(currentRow, 5);
        rightLabel.value = rightItem.label;
        rightLabel.font = { name: "Times New Roman", size: 12 };
        rightLabel.alignment = { horizontal: "center", vertical: "middle" };
      }

      worksheet.getRow(currentRow).height = 20;
      currentRow += 1;

      // Format Image Row
      [1, 2, 3].forEach((c) => (worksheet.getCell(currentRow, c).border = borderStyle));
      if (rightItem) {
        [5, 6, 7].forEach((c) => (worksheet.getCell(currentRow, c).border = borderStyle));
      }

      worksheet.mergeCells(currentRow, 1, currentRow, 3);
      if (rightItem) {
        worksheet.mergeCells(currentRow, 5, currentRow, 7);
      }

      let leftHeight = 100;
      let rightHeight = 100;

      // Process Left Image (Col Index 0 -> A)
      const leftRes = await processAndAddImage(workbook, worksheet, leftItem.photo, 0, currentRow - 1, fixedImageWidth);
      if (leftRes.error) {
        worksheet.getCell(currentRow, 1).value = leftRes.error;
        worksheet.getCell(currentRow, 1).font = { italic: true, color: { argb: "FF991B1B" } };
      } else {
        leftHeight = leftRes.height!;
      }

      // Process Right Image (Col Index 4 -> E)
      if (rightItem) {
        const rightRes = await processAndAddImage(workbook, worksheet, rightItem.photo, 4, currentRow - 1, fixedImageWidth);
        if (rightRes.error) {
          worksheet.getCell(currentRow, 5).value = rightRes.error;
          worksheet.getCell(currentRow, 5).font = { italic: true, color: { argb: "FF991B1B" } };
        } else {
          rightHeight = rightRes.height!;
        }
      }

      // Size row dynamically to fit the tallest image with standard Excel margins
      const maxRowHeight = Math.max(leftHeight, rightHeight);
      worksheet.getRow(currentRow).height = maxRowHeight * excelPointsPerPixel + 2;

      currentRow += 2; // Jump 2 rows, leaving one empty spacing row between rows of images
    }
  }

  // Fallback if no categories exist at all
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
