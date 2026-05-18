import { uploadPendingPhoto } from "../api/photos";
import { countPendingPhotos, getPendingUploadPhotos, markPhotoSynced } from "../db/photos";

export type PhotoSyncResult = {
  attempted: number;
  synced: number;
  remaining: number;
};

let syncInProgress = false;

export async function syncPendingPhotos(): Promise<PhotoSyncResult> {
  if (syncInProgress) {
    return {
      attempted: 0,
      synced: 0,
      remaining: await countPendingPhotos(),
    };
  }

  syncInProgress = true;

  try {
    const pendingPhotos = await getPendingUploadPhotos();
    let synced = 0;

    for (const photo of pendingPhotos) {
      const serverPhotoId = await uploadPendingPhoto(photo);
      await markPhotoSynced(photo.id, serverPhotoId);
      synced += 1;
    }

    return {
      attempted: pendingPhotos.length,
      synced,
      remaining: await countPendingPhotos(),
    };
  } finally {
    syncInProgress = false;
  }
}
