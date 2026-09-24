import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const dailyRecords = sqliteTable(
  "daily_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    schoolId: integer("school_id").notNull(),
    schoolName: text("school_name").notNull(),
    recordDate: text("record_date").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    responsible: text("responsible"),
    status: text("status").notNull(),
    createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  },
  (t) => [index("idx_daily_records_school_id").on(t.schoolId)],
);

export const schoolUpdates = sqliteTable(
  "school_updates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    schoolId: integer("school_id").notNull(),
    schoolName: text("school_name").notNull(),
    type: text("type").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_school_updates_school_id").on(t.schoolId),
    index("idx_school_updates_type").on(t.type),
  ],
);

export const schools = sqliteTable(
  "schools",
  {
    schoolId: integer("school_id").primaryKey(),
    schoolName: text("school_name").notNull(),
    payload: text("payload").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_schools_school_name").on(t.schoolName)],
);

export const schoolAccesses = sqliteTable(
  "school_accesses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    schoolId: integer("school_id").notNull(),
    schoolName: text("school_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_school_accesses_created_at").on(t.createdAt),
    index("idx_school_accesses_school_id").on(t.schoolId),
  ],
);

export const validationRecords = sqliteTable(
  "validation_records",
  {
    validationSchoolId: integer("validation_school_id").primaryKey(),
    schoolName: text("school_name").notNull(),
    status: text("status").notNull(),
    payload: text("payload").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_validation_records_status").on(t.status)],
);

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appMetadata = sqliteTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const deletedItems = sqliteTable(
  "deleted_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    payload: text("payload").notNull(),
    deletedAt: text("deleted_at").notNull(),
  },
  (t) => [
    index("idx_deleted_items_entity_type").on(t.entityType),
    index("idx_deleted_items_deleted_at").on(t.deletedAt),
  ],
);
