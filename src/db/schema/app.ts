import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const MEDIA_TYPES = [
  "anime",
  "manga",
  "light_novel",
  "visual_novel",
  "movie",
  "series",
  "book",
  "graded_reader",
  "youtube",
  "podcast",
  "drama_cd",
  "game",
  "news",
  "other",
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];
export const mediaTypeEnum = pgEnum("media_type", MEDIA_TYPES);

export const MEDIA_SOURCES = ["manual", "anilist", "vndb", "tmdb", "google_books"] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];
export const mediaSourceEnum = pgEnum("media_source", MEDIA_SOURCES);

// Native progress units. Time is always tracked separately as duration_seconds.
export const UNITS = ["episodes", "chapters", "volumes", "pages", "characters", "words", "items"] as const;
export type Unit = (typeof UNITS)[number];
export const unitEnum = pgEnum("unit", UNITS);

export const ENTRY_STATUSES = ["planning", "active", "paused", "finished", "dropped"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export const entryStatusEnum = pgEnum("entry_status", ENTRY_STATUSES);

// Goal metrics: "time" (hours) or any native unit.
export const GOAL_METRICS = ["time", ...UNITS] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export const goalMetricEnum = pgEnum("goal_metric", GOAL_METRICS);

/** A piece of media, shared across users. Deduplicated on (source, source_id) for external items. */
export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: mediaTypeEnum("type").notNull(),
    title: text("title").notNull(),
    titleNative: text("title_native"),
    coverUrl: text("cover_url"),
    year: smallint("year"),
    description: text("description"),
    externalUrl: text("external_url"),
    source: mediaSourceEnum("source").notNull().default("manual"),
    sourceId: text("source_id"),
    // Known total length in native units (12 episodes, 300 pages, 1.2M chars...)
    totalAmount: integer("total_amount"),
    totalUnit: unitEnum("total_unit"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Manual items belong to whoever created them; external items are shared.
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("media_items_source_idx").on(t.source, t.sourceId),
    index("media_items_type_idx").on(t.type),
  ],
);

/** A user's relationship to a media item: status + progress. */
export const libraryEntries = pgTable(
  "library_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    status: entryStatusEnum("status").notNull().default("planning"),
    progress: integer("progress").notNull().default(0),
    progressUnit: unitEnum("progress_unit"),
    rating: smallint("rating"), // 1-10
    notes: text("notes"),
    startedAt: date("started_at"),
    finishedAt: date("finished_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("library_entries_user_media_idx").on(t.userId, t.mediaItemId),
    index("library_entries_user_status_idx").on(t.userId, t.status),
  ],
);

/** The core primitive: a block of immersion time, optionally tied to a media item. */
export const immersionSessions = pgTable(
  "immersion_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id").references(() => mediaItems.id, { onDelete: "set null" }),
    // Denormalized so item-less sessions ("talked with a tutor") still count toward per-type stats.
    mediaType: mediaTypeEnum("media_type").notNull(),
    // Free-text label for item-less sessions, or an override.
    label: text("label"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    amount: integer("amount"),
    amountUnit: unitEnum("amount_unit"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("immersion_sessions_user_started_idx").on(t.userId, t.startedAt),
    index("immersion_sessions_media_idx").on(t.mediaItemId),
  ],
);

/** One running timer per user. Stopping it materializes an immersion session. */
export const activeTimers = pgTable("active_timers", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  mediaItemId: uuid("media_item_id").references(() => mediaItems.id, { onDelete: "set null" }),
  mediaType: mediaTypeEnum("media_type").notNull(),
  label: text("label"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
});

/** "1000 hours in 2026", "2M characters of VNs this month", etc. */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    metric: goalMetricEnum("metric").notNull().default("time"),
    // null = all media types
    mediaType: mediaTypeEnum("media_type"),
    // For metric=time this is hours; otherwise the native unit count.
    target: integer("target").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

// --- Relations (for db.query.* relational API) ---

export const mediaItemsRelations = relations(mediaItems, ({ many }) => ({
  entries: many(libraryEntries),
  sessions: many(immersionSessions),
}));

export const libraryEntriesRelations = relations(libraryEntries, ({ one }) => ({
  user: one(user, { fields: [libraryEntries.userId], references: [user.id] }),
  mediaItem: one(mediaItems, { fields: [libraryEntries.mediaItemId], references: [mediaItems.id] }),
}));

export const immersionSessionsRelations = relations(immersionSessions, ({ one }) => ({
  user: one(user, { fields: [immersionSessions.userId], references: [user.id] }),
  mediaItem: one(mediaItems, { fields: [immersionSessions.mediaItemId], references: [mediaItems.id] }),
}));

export const activeTimersRelations = relations(activeTimers, ({ one }) => ({
  mediaItem: one(mediaItems, { fields: [activeTimers.mediaItemId], references: [mediaItems.id] }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(user, { fields: [goals.userId], references: [user.id] }),
}));
