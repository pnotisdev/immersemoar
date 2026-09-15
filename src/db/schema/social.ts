import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { immersionSessions } from "./app";
import { user } from "./auth";

/** Directed follow edge. Following is one-way and needs no approval; private profiles are hidden from feeds. */
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
  ],
);

/** A "nice session" reaction — the only social signal on a session, kept deliberately simple. */
export const sessionKudos = pgTable(
  "session_kudos",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => immersionSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] }), index("session_kudos_session_idx").on(t.sessionId)],
);

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(user, { fields: [follows.followerId], references: [user.id], relationName: "follower" }),
  following: one(user, { fields: [follows.followingId], references: [user.id], relationName: "following" }),
}));

export const sessionKudosRelations = relations(sessionKudos, ({ one }) => ({
  session: one(immersionSessions, { fields: [sessionKudos.sessionId], references: [immersionSessions.id] }),
  user: one(user, { fields: [sessionKudos.userId], references: [user.id] }),
}));
