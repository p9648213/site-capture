import path from "node:path";

export const uploadsRoot = path.resolve(process.cwd(), "uploads");

const imageContentTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
} as const;

export type SupportedImageExtension = keyof typeof imageContentTypes;

export function getSupportedImageExtension(file: File) {
  const extension = path.extname(file.name).toLowerCase();

  if (extension in imageContentTypes) {
    return extension as SupportedImageExtension;
  }

  if (file.type === "image/jpeg") {
    return ".jpg";
  }

  if (file.type === "image/png") {
    return ".png";
  }

  return null;
}

export function getContentTypeForPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension in imageContentTypes) {
    return imageContentTypes[extension as SupportedImageExtension];
  }

  return "application/octet-stream";
}

export function buildStoredPhotoPath(input: {
  siteId: number;
  categoryId: number;
  pictureTypeId: number;
  photoId: string;
  extension: SupportedImageExtension;
}) {
  return path.join(
    "uploads",
    `site_${input.siteId}`,
    `category_${input.categoryId}`,
    `type_${input.pictureTypeId}`,
    `${input.photoId}${input.extension}`,
  );
}

export function resolveUploadPath(relativePathParts: string[]) {
  const resolvedPath = path.resolve(uploadsRoot, ...relativePathParts);
  const relativeToUploads = path.relative(uploadsRoot, resolvedPath);

  if (
    relativeToUploads.startsWith("..") ||
    path.isAbsolute(relativeToUploads) ||
    relativeToUploads.length === 0
  ) {
    return null;
  }

  return resolvedPath;
}

export function resolveStoredPhotoPath(serverFilePath: string) {
  const normalizedPath = serverFilePath.replace(/^\/+/, "");
  const uploadsPrefix = `uploads${path.sep}`;

  if (!normalizedPath.startsWith(uploadsPrefix) && normalizedPath !== "uploads") {
    return null;
  }

  const relativeToUploads = normalizedPath === "uploads" ? "" : normalizedPath.slice(uploadsPrefix.length);
  return resolveUploadPath(relativeToUploads.split(path.sep).filter(Boolean));
}
