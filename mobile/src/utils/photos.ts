import * as FileSystem from "expo-file-system/legacy";

function getPhotoDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Document storage is not available on this device.");
  }

  return `${FileSystem.documentDirectory}sitecapture/photos/`;
}

export async function ensurePhotoDirectory() {
  const photoDirectory = getPhotoDirectory();
  await FileSystem.makeDirectoryAsync(photoDirectory, { intermediates: true });
  return photoDirectory;
}

export function buildLocalPhotoUri(pictureTypeId: number, capturedAt: string) {
  const safeTimestamp = capturedAt.replace(/[:.]/g, "-");
  return `${getPhotoDirectory()}picture_type_${pictureTypeId}_${safeTimestamp}.jpg`;
}
