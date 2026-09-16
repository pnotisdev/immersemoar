import { relations } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { mediaItems } from "./app";
import { user } from "./auth";

export const CLUB_VISIBILITIES = ["public", "private"] as const;
export type ClubVisibility = (typeof CLUB_VISIBILITIES)[number];
export const clubVisibilityEnum = pgEnum("club_visibility", CLUB_VISIBILITIES);

export const CLUB_ROLES = ["owner", "member"] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];
export const clubRoleEnum = pgEnum("club_role", CLUB_ROLES);

export const PICK_STATUSES = ["proposed", "current", "done"] as const;
export type PickStatus = (typeof PICK_STATUSES)[number];
export const pickStatusEnum = pgEnum("pick_status", PICK_STATUSES);

/** Curated tags so clubs are discoverable by level, medium and vibe. */
export const CLUB_TAGS = [
  "beginner",
  "intermediate",
  "advanced",
  "anime",
  "manga",
  "visual-novel",
  "light-novel",
  "books",
  "listening",
  "reading",
  "competitive",
  "casual",
  "study-group",
] as const;
export type ClubTag = (typeof CLUB_TAGS)[number];

export const clubs = pgTable(
  "clubs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    visibility: clubVisibilityEnum("visibility").notNull().default("public"),
    tags: text("tags").array().notNull().default([]),
    coverUrl: text("cover_url"),
    // Private clubs are joined with this code; owners can rotate it.
    joinCode: text("join_code").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Moderation: hidden clubs drop out of public discovery and, for non-members,
    // the club page itself — same treatment as a private club (see clubs/[id]/page.tsx).
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clubs_visibility_idx").on(t.visibility)],
);

export const clubMembers = pgTable(
  "club_members",
  {
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: clubRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.userId] }), index("club_members_user_idx").on(t.userId)],
);

/** Something a member proposes the club consume together. Votes decide; the owner promotes one to "current". */
export const clubPicks = pgTable(
  "club_picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    proposedBy: text("proposed_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: pickStatusEnum("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_picks_club_idx").on(t.clubId, t.status)],
);

export const clubPickVotes = pgTable(
  "club_pick_votes",
  {
    pickId: uuid("pick_id")
      .notNull()
      .references(() => clubPicks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.pickId, t.userId] })],
);

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  owner: one(user, { fields: [clubs.ownerId], references: [user.id] }),
  members: many(clubMembers),
  picks: many(clubPicks),
}));

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  club: one(clubs, { fields: [clubMembers.clubId], references: [clubs.id] }),
  user: one(user, { fields: [clubMembers.userId], references: [user.id] }),
}));

export const clubPicksRelations = relations(clubPicks, ({ one, many }) => ({
  club: one(clubs, { fields: [clubPicks.clubId], references: [clubs.id] }),
  mediaItem: one(mediaItems, { fields: [clubPicks.mediaItemId], references: [mediaItems.id] }),
  proposer: one(user, { fields: [clubPicks.proposedBy], references: [user.id] }),
  votes: many(clubPickVotes),
}));

export const clubPickVotesRelations = relations(clubPickVotes, ({ one }) => ({
  pick: one(clubPicks, { fields: [clubPickVotes.pickId], references: [clubPicks.id] }),
  user: one(user, { fields: [clubPickVotes.userId], references: [user.id] }),
}));
