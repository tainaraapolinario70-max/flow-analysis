let schemaInitialization: Promise<void> | undefined;

/**
 * Creates the small operational schema when the app is started outside Sites.
 *
 * The hosted Site still receives its normal migrations. This guard mainly makes
 * the LAN launcher self-contained: the first request prepares the local D1
 * database and every computer connected to the server uses that same database.
 */
export function ensureDatabaseSchema(db: D1Database): Promise<void> {
  if (!schemaInitialization) {
    schemaInitialization = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS daily_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          school_id INTEGER NOT NULL,
          school_name TEXT NOT NULL,
          record_date TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          responsible TEXT,
          status TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_daily_records_school_id ON daily_records (school_id)`,
        ),
        db.prepare(`CREATE TABLE IF NOT EXISTS school_updates (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          school_id INTEGER NOT NULL,
          school_name TEXT NOT NULL,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_school_updates_school_id ON school_updates (school_id)`,
        ),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_school_updates_type ON school_updates (type)`,
        ),
        db.prepare(`CREATE TABLE IF NOT EXISTS schools (
          school_id INTEGER PRIMARY KEY NOT NULL,
          school_name TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_schools_school_name ON schools (school_name)`,
        ),
        db.prepare(`CREATE TABLE IF NOT EXISTS school_accesses (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          school_id INTEGER NOT NULL,
          school_name TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_school_accesses_created_at ON school_accesses (created_at)`,
        ),
        db.prepare(
          `CREATE INDEX IF NOT EXISTS idx_school_accesses_school_id ON school_accesses (school_id)`,
        ),
        db.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
          id INTEGER PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        )`),
      ])
      .then(() => undefined)
      .catch((error) => {
        schemaInitialization = undefined;
        throw error;
      });
  }

  return schemaInitialization;
}
