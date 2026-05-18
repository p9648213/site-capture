export type PhotoSyncStatus = "PENDING" | "SYNCED";

export type LocalPhoto = {
  id: number;
  pictureTypeId: number;
  localUri: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
  syncStatus: PhotoSyncStatus;
  serverPhotoId: number | null;
};

export type PendingUploadPhoto = LocalPhoto & {
  siteId: number;
  categoryId: number;
};
