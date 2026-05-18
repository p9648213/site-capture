import axios from "axios";
import { API_BASE_URL, MOBILE_API_KEY, assertApiConfig } from "./config";
import type { PendingUploadPhoto } from "../types/photo";

type UploadResponse = {
  photo?: {
    id: number;
  };
  server_photo_id?: number;
};

function getFileName(uri: string, photoId: number) {
  const fileName = uri.split("/").pop();
  return fileName && fileName.includes(".") ? fileName : `sitecapture_${photoId}.jpg`;
}

export async function uploadPendingPhoto(photo: PendingUploadPhoto) {
  assertApiConfig();

  const form = new FormData();
  form.append("siteId", String(photo.siteId));
  form.append("categoryId", String(photo.categoryId));
  form.append("pictureTypeId", String(photo.pictureTypeId));
  form.append("capturedAt", photo.capturedAt);
  form.append("localUri", photo.localUri);

  if (photo.latitude !== null) {
    form.append("latitude", String(photo.latitude));
  }

  if (photo.longitude !== null) {
    form.append("longitude", String(photo.longitude));
  }

  form.append("file", {
    uri: photo.localUri,
    name: getFileName(photo.localUri, photo.id),
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await axios.post<UploadResponse>(`${API_BASE_URL}/api/photos/upload`, form, {
    headers: {
      "x-api-key": MOBILE_API_KEY,
      "Content-Type": "multipart/form-data",
    },
  });

  const serverPhotoId = response.data.server_photo_id ?? response.data.photo?.id;

  if (!serverPhotoId) {
    throw new Error("Upload response did not include server_photo_id.");
  }

  return serverPhotoId;
}
