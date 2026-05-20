import { getDatabase, runSerializedTransaction } from "./database";
import type { Category, PictureType, Site, SiteWithCategories, SyncResponse } from "../types/site";

type SiteRow = {
  id: number;
  name: string;
  site_id: string;
  status: Site["status"];
  last_synced_at: string | null;
};

type CategoryRow = {
  id: number;
  site_id: number;
  name: string;
  status: Category["status"];
  last_synced_at: string | null;
};

type PictureTypeRow = {
  id: number;
  category_id: number;
  name: string;
  is_fulfilled: number;
  last_synced_at: string | null;
};

function mapSite(row: SiteRow): Site {
  return {
    id: row.id,
    name: row.name,
    siteId: row.site_id,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    siteId: row.site_id,
    name: row.name,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
  };
}

function mapPictureType(row: PictureTypeRow): PictureType {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    isFulfilled: row.is_fulfilled === 1,
    lastSyncedAt: row.last_synced_at,
  };
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(", ");
}

type DatabaseExecutor = Pick<Awaited<ReturnType<typeof getDatabase>>, "runAsync">;

async function deleteRowsNotIn(db: DatabaseExecutor, table: string, ids: number[]) {
  if (ids.length === 0) {
    await db.runAsync(`DELETE FROM ${table}`);
    return;
  }

  await db.runAsync(`DELETE FROM ${table} WHERE id NOT IN (${placeholders(ids)})`, ids);
}

export async function upsertSyncedSites(payload: SyncResponse) {
  const syncedSiteIds = payload.sites.map((site) => site.id);
  const syncedCategoryIds = payload.sites.flatMap((site) =>
    site.categories.map((category) => category.id),
  );
  const syncedPictureTypeIds = payload.sites.flatMap((site) =>
    site.categories.flatMap((category) =>
      category.pictureTypes.map((pictureType) => pictureType.id),
    ),
  );

  await runSerializedTransaction(async (tx) => {
    for (const site of payload.sites) {
      await tx.runAsync(
        `INSERT INTO sites (id, name, site_id, status, last_synced_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           site_id = excluded.site_id,
           status = excluded.status,
           last_synced_at = excluded.last_synced_at`,
        [site.id, site.name, site.siteId, site.status, payload.syncedAt],
      );

      for (const category of site.categories) {
        await tx.runAsync(
          `INSERT INTO categories (id, site_id, name, status, last_synced_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             site_id = excluded.site_id,
             name = excluded.name,
             status = excluded.status,
             last_synced_at = excluded.last_synced_at`,
          [category.id, site.id, category.name, category.status, payload.syncedAt],
        );

        for (const pictureType of category.pictureTypes) {
          await tx.runAsync(
            `INSERT INTO picture_types (id, category_id, name, is_fulfilled, last_synced_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               category_id = excluded.category_id,
               name = excluded.name,
               is_fulfilled = excluded.is_fulfilled,
               last_synced_at = excluded.last_synced_at`,
            [
              pictureType.id,
              category.id,
              pictureType.name,
              pictureType.isFulfilled ? 1 : 0,
              payload.syncedAt,
            ],
          );
        }
      }
    }

    await deleteRowsNotIn(tx, "picture_types", syncedPictureTypeIds);
    await deleteRowsNotIn(tx, "categories", syncedCategoryIds);
    await deleteRowsNotIn(tx, "sites", syncedSiteIds);

    await tx.runAsync(
      `INSERT INTO sync_meta (key, value)
       VALUES ('sites_last_synced_at', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [payload.syncedAt],
    );
  });
}

export async function getLastSyncedAt() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'sites_last_synced_at'",
  );

  return row?.value ?? null;
}

export async function getSites() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SiteRow>(
    "SELECT id, name, site_id, status, last_synced_at FROM sites ORDER BY name COLLATE NOCASE ASC",
  );

  return rows.map(mapSite);
}

export async function getSiteWithCategories(siteId: number): Promise<SiteWithCategories | null> {
  const db = await getDatabase();
  const siteRow = await db.getFirstAsync<SiteRow>(
    "SELECT id, name, site_id, status, last_synced_at FROM sites WHERE id = ?",
    [siteId],
  );

  if (!siteRow) {
    return null;
  }

  const categoryRows = await db.getAllAsync<CategoryRow>(
    "SELECT id, site_id, name, status, last_synced_at FROM categories WHERE site_id = ? ORDER BY id ASC",
    [siteId],
  );
  const categories = [];

  for (const categoryRow of categoryRows) {
    const pictureTypeRows = await db.getAllAsync<PictureTypeRow>(
      `SELECT id, category_id, name, is_fulfilled, last_synced_at
       FROM picture_types
       WHERE category_id = ?
       ORDER BY id ASC`,
      [categoryRow.id],
    );

    categories.push({
      ...mapCategory(categoryRow),
      pictureTypes: pictureTypeRows.map(mapPictureType),
    });
  }

  return {
    ...mapSite(siteRow),
    categories,
  };
}
