import { getDatabase, runSerializedTransaction, runSerializedWrite } from "./database";
import type { LocalPhoto, PendingUploadPhoto } from "../types/photo";

export type PendingPhotoInput = {
  siteId: number;
  categoryId: number;
  pictureTypeId: number;
  localUri: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;
};

export async function insertPendingPhoto(input: PendingPhotoInput) {
  await runSerializedTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO photos (
        picture_type_id,
        local_uri,
        latitude,
        longitude,
        captured_at,
        sync_status,
        server_photo_id
      )
      VALUES (?, ?, ?, ?, ?, 'PENDING', NULL)`,
      [
        input.pictureTypeId,
        input.localUri,
        input.latitude,
        input.longitude,
        input.capturedAt,
      ],
    );

    await tx.runAsync("UPDATE picture_types SET is_fulfilled = 1 WHERE id = ?", [
      input.pictureTypeId,
    ]);

    const unfulfilledPictureTypes = await tx.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM picture_types WHERE category_id = ? AND is_fulfilled = 0",
      [input.categoryId],
    );

    await tx.runAsync("UPDATE categories SET status = ? WHERE id = ?", [
      unfulfilledPictureTypes?.count === 0 ? "COMPLETED" : "INCOMPLETE",
      input.categoryId,
    ]);

    const incompleteCategories = await tx.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM categories WHERE site_id = ? AND status = 'INCOMPLETE'",
      [input.siteId],
    );

    await tx.runAsync("UPDATE sites SET status = ? WHERE id = ?", [
      incompleteCategories?.count === 0 ? "COMPLETED" : "INCOMPLETE",
      input.siteId,
    ]);
  });
}

export async function countPendingPhotos() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM photos WHERE sync_status = 'PENDING'",
  );

  return row?.count ?? 0;
}

type LocalPhotoRow = {
  id: number;
  picture_type_id: number;
  local_uri: string;
  latitude: number | null;
  longitude: number | null;
  captured_at: string;
  sync_status: "PENDING" | "SYNCED";
  server_photo_id: number | null;
};

function mapLocalPhoto(row: LocalPhotoRow): LocalPhoto {
  return {
    id: row.id,
    pictureTypeId: row.picture_type_id,
    localUri: row.local_uri,
    latitude: row.latitude,
    longitude: row.longitude,
    capturedAt: row.captured_at,
    syncStatus: row.sync_status,
    serverPhotoId: row.server_photo_id,
  };
}

export async function getLatestPhotoForPictureType(pictureTypeId: number) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalPhotoRow>(
    `SELECT
       id,
       picture_type_id,
       local_uri,
       latitude,
       longitude,
       captured_at,
       sync_status,
       server_photo_id
     FROM photos
     WHERE picture_type_id = ?
     ORDER BY captured_at DESC, id DESC
     LIMIT 1`,
    [pictureTypeId],
  );

  return row ? mapLocalPhoto(row) : null;
}

type PendingUploadPhotoRow = {
  id: number;
  picture_type_id: number;
  local_uri: string;
  latitude: number | null;
  longitude: number | null;
  captured_at: string;
  sync_status: "PENDING";
  server_photo_id: number | null;
  category_id: number;
  site_id: number;
};

function mapPendingUploadPhoto(row: PendingUploadPhotoRow): PendingUploadPhoto {
  return {
    id: row.id,
    pictureTypeId: row.picture_type_id,
    localUri: row.local_uri,
    latitude: row.latitude,
    longitude: row.longitude,
    capturedAt: row.captured_at,
    syncStatus: row.sync_status,
    serverPhotoId: row.server_photo_id,
    categoryId: row.category_id,
    siteId: row.site_id,
  };
}

export async function getPendingUploadPhotos() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PendingUploadPhotoRow>(
    `SELECT
       photos.id,
       photos.picture_type_id,
       photos.local_uri,
       photos.latitude,
       photos.longitude,
       photos.captured_at,
       photos.sync_status,
       photos.server_photo_id,
       picture_types.category_id,
       categories.site_id
     FROM photos
     INNER JOIN picture_types ON picture_types.id = photos.picture_type_id
     INNER JOIN categories ON categories.id = picture_types.category_id
     WHERE photos.sync_status = 'PENDING'
     ORDER BY photos.captured_at ASC`,
  );

  return rows.map(mapPendingUploadPhoto);
}

export async function markPhotoSynced(localPhotoId: number, serverPhotoId: number) {
  await runSerializedWrite(async (db) =>
    db.runAsync(
      `UPDATE photos
       SET sync_status = 'SYNCED', server_photo_id = ?
       WHERE id = ?`,
      [serverPhotoId, localPhotoId],
    ),
  );
}
