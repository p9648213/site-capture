import * as SQLite from "expo-sqlite";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase() {
  databasePromise ??= SQLite.openDatabaseAsync("sitecapture.db");
  return databasePromise;
}

export async function initializeDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('INCOMPLETE', 'COMPLETED')),
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY NOT NULL,
      site_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('INCOMPLETE', 'COMPLETED')),
      last_synced_at TEXT,
      FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS picture_types (
      id INTEGER PRIMARY KEY NOT NULL,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_fulfilled INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      picture_type_id INTEGER NOT NULL,
      local_uri TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      captured_at TEXT NOT NULL,
      sync_status TEXT NOT NULL CHECK(sync_status IN ('PENDING', 'SYNCED')),
      server_photo_id INTEGER,
      FOREIGN KEY(picture_type_id) REFERENCES picture_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}
