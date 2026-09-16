/**
 * Seeds a believable community: demo members, real cover art from AniList and VNDB,
 * months of immersion sessions, follows, kudos and a club.
 *
 *   pnpm seed:demo            # add demo data
 *   pnpm seed:demo --reset    # remove previously seeded demo members first
 *
 * Demo accounts are real accounts (email + password) so you can sign in as them and
 * see the app from another member's side. They are recognisable by their email domain.
 *
 * Run via `pnpm seed:demo`, not bare `tsx scripts/seed-demo.ts`: this script calls into
 * src/lib/auth.ts, which imports src/lib/email.ts, which is marked `import "server-only"`
 * — a marker package that throws unless the "react-server" export condition is active.
 * Next's own bundler sets that condition automatically; a standalone Node/tsx process
 * doesn't, so the package.json script passes `--conditions=react-server` explicitly.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { desc, eq, inArray, like } from "drizzle-orm";
import { db } from "../src/db";
import {
  clubMembers,
  clubPickVotes,
  clubPicks,
  clubs,
  follows,
  immersionSessions,
  libraryEntries,
  mediaItems,
  sessionKudos,
  user,
  type MediaType,
  type Unit,
} from "../src/db/schema";
import { auth } from "../src/lib/auth";
import { MEDIA_TYPE_META } from "../src/lib/media";
import { browseAniList } from "../src/lib/sources/anilist";
import { browseVndb } from "../src/lib/sources/vndb";
import type { SearchResult } from "../src/lib/sources/types";

const DEMO_DOMAIN = "@demo.immersemoar.app";
const DEMO_PASSWORD = "immerse-demo-2026";

interface DemoUser {
  name: string;
  handle: string;
  timezone: string;
  /** Typical minutes per day; the generator varies around it. */
  minutesPerDay: number;
  /** How many of the last N days they have been tracking. */
  historyDays: number;
  /** Chance of skipping a day (0 = never misses). */
  skipRate: number;
  favors: MediaType[];
}

const DEMO_USERS: DemoUser[] = [
  { name: "Mika Aoyama", handle: "mika", timezone: "Asia/Tokyo", minutesPerDay: 190, historyDays: 300, skipRate: 0.04, favors: ["visual_novel", "manga", "anime"] },
  { name: "Ren Takahashi", handle: "ren", timezone: "Asia/Tokyo", minutesPerDay: 145, historyDays: 240, skipRate: 0.08, favors: ["anime", "youtube", "podcast"] },
  { name: "Sofia Almeida", handle: "sofia", timezone: "Europe/Lisbon", minutesPerDay: 120, historyDays: 210, skipRate: 0.1, favors: ["manga", "light_novel", "anime"] },
  { name: "Dan Nowak", handle: "dan", timezone: "Europe/Warsaw", minutesPerDay: 95, historyDays: 180, skipRate: 0.12, favors: ["visual_novel", "anime"] },
  { name: "Hana Lee", handle: "hana", timezone: "Asia/Seoul", minutesPerDay: 80, historyDays: 150, skipRate: 0.15, favors: ["anime", "manga", "drama_cd"] },
  { name: "Oliver Bennett", handle: "oliver", timezone: "Europe/London", minutesPerDay: 65, historyDays: 120, skipRate: 0.2, favors: ["book", "light_novel", "podcast"] },
  { name: "Emma Carter", handle: "emma", timezone: "America/New_York", minutesPerDay: 55, historyDays: 90, skipRate: 0.25, favors: ["anime", "youtube"] },
  { name: "Yuki Sato", handle: "yuki", timezone: "Asia/Tokyo", minutesPerDay: 40, historyDays: 45, skipRate: 0.3, favors: ["manga", "anime"] },
  { name: "Lucas Moreau", handle: "lucas", timezone: "Europe/Paris", minutesPerDay: 30, historyDays: 21, skipRate: 0.3, favors: ["anime", "visual_novel"] },
];

// --- Deterministic PRNG so repeated seeds produce the same shape ---
let seed = 20260915;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function between(min: number, max: number) {
  return min + rand() * (max - min);
}

async function main() {
  const reset = process.argv.includes("--reset");

  if (reset) {
    const existing = await db.select({ id: user.id }).from(user).where(like(user.email, `%${DEMO_DOMAIN}`));
    if (existing.length > 0) {
      const ids = existing.map((u) => u.id);
      await db.delete(clubs).where(inArray(clubs.ownerId, ids));
      await db.delete(user).where(inArray(user.id, ids));
      console.log(`Removed ${ids.length} demo member(s) and their data.`);
    }
  }

  console.log("Fetching cover art from AniList and VNDB…");
  const catalogue = await fetchCatalogue();
  console.log(`  ${catalogue.length} titles with artwork.`);

  const itemIds = await upsertMediaItems(catalogue);
  console.log(`Media items in the database: ${itemIds.size}`);

  const users = await ensureUsers();
  console.log(`Demo members: ${users.length}`);

  for (const u of users) {
    await seedUser(u, catalogue, itemIds);
  }

  await seedFollows(users.map((u) => u.id));
  await seedKudos(users.map((u) => u.id));
  await seedClub(users, catalogue, itemIds);

  console.log("\nDone. Sign in as any demo member:");
  for (const u of users) console.log(`  ${u.handle}${DEMO_DOMAIN} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

// --- Catalogue ---

async function fetchCatalogue(): Promise<SearchResult[]> {
  const [anime, manga, novels, vns] = await Promise.all([
    browseAniList("anime", "POPULARITY_DESC", 24).catch(fail("anime")),
    browseAniList("manga", "POPULARITY_DESC", 18).catch(fail("manga")),
    browseAniList("light_novel", "POPULARITY_DESC", 12).catch(fail("light novels")),
    browseVndb(14).catch(fail("visual novels")),
  ]);
  return [...anime, ...manga, ...novels, ...vns].filter((r) => r.coverUrl);
}

function fail(what: string) {
  return (err: unknown) => {
    console.warn(`  could not load ${what}:`, err instanceof Error ? err.message : err);
    return [] as SearchResult[];
  };
}

async function upsertMediaItems(catalogue: SearchResult[]) {
  const ids = new Map<string, string>(); // sourceId -> media_items.id
  for (const r of catalogue) {
    const [row] = await db
      .insert(mediaItems)
      .values({
        type: r.mediaType,
        title: r.title,
        titleNative: r.titleNative,
        coverUrl: r.coverUrl,
        bannerUrl: r.bannerUrl,
        year: r.year,
        description: r.description,
        externalUrl: r.externalUrl,
        source: r.source,
        sourceId: r.sourceId,
        totalAmount: r.totalAmount,
        totalUnit: r.totalUnit,
        metadata: r.metadata,
      })
      .onConflictDoUpdate({
        target: [mediaItems.source, mediaItems.sourceId],
        set: {
          title: r.title,
          titleNative: r.titleNative,
          coverUrl: r.coverUrl,
          bannerUrl: r.bannerUrl,
          description: r.description,
          externalUrl: r.externalUrl,
          totalAmount: r.totalAmount,
          totalUnit: r.totalUnit,
        },
      })
      .returning({ id: mediaItems.id });
    ids.set(`${r.source}:${r.sourceId}`, row.id);
  }
  return ids;
}

// --- Members ---

interface SeededUser extends DemoUser {
  id: string;
}

async function ensureUsers(): Promise<SeededUser[]> {
  const out: SeededUser[] = [];
  for (const d of DEMO_USERS) {
    const email = `${d.handle}${DEMO_DOMAIN}`;
    const existing = await db.query.user.findFirst({ where: eq(user.email, email), columns: { id: true } });
    if (existing) {
      out.push({ ...d, id: existing.id });
      continue;
    }
    try {
      // Passing `handle` as the username here (rather than leaving it to the
      // auto-generate-on-signup hook in src/lib/auth.ts) is what gives demo profiles
      // clean, memorable URLs like /u/mika instead of a slugified full name.
      await auth.api.signUpEmail({
        body: { email, password: DEMO_PASSWORD, name: d.name, timezone: d.timezone, publicProfile: true, username: d.handle },
      });
    } catch (err) {
      console.warn(`  sign-up failed for ${email}:`, err instanceof Error ? err.message : err);
      continue;
    }
    const created = await db.query.user.findFirst({ where: eq(user.email, email), columns: { id: true } });
    if (!created) continue;
    await db
      .update(user)
      .set({
        image: avatarUrl(d.handle),
        // Backdate the account so "member since" reads like a real community.
        createdAt: daysAgo(d.historyDays + 3),
        // Safety net independent of `pnpm seed:demo --reset`: keeps demo members out of
        // the leaderboard/"most active" sort even if the reset script is never run
        // before launch. See src/lib/ranking-queries.ts and src/lib/social-queries.ts.
        isDemo: true,
      })
      .where(eq(user.id, created.id));
    out.push({ ...d, id: created.id });
  }
  return out;
}

/** DiceBear line-art portraits on a soft tint: recognisable at 28px, neutral enough not to shout. */
const AVATAR_BACKGROUNDS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "c8e6c9"];
function avatarUrl(handle: string) {
  const bg = AVATAR_BACKGROUNDS[handle.length % AVATAR_BACKGROUNDS.length];
  return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${handle}&backgroundColor=${bg}&radius=50`;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}

// --- Library + sessions ---

async function seedUser(u: SeededUser, catalogue: SearchResult[], itemIds: Map<string, string>) {
  const existing = await db
    .select({ id: immersionSessions.id })
    .from(immersionSessions)
    .where(eq(immersionSessions.userId, u.id))
    .limit(1);
  if (existing.length > 0) {
    console.log(`  ${u.name}: already has sessions, skipping`);
    return;
  }

  // Their shelf: titles in the media types they favour, plus a couple of outliers.
  const favoured = catalogue.filter((c) => u.favors.includes(c.mediaType));
  const shelf = sample(favoured.length >= 6 ? favoured : catalogue, Math.round(between(7, 12)));

  const entries: { itemId: string; type: MediaType; unit: Unit | null; total: number | null; progress: number }[] = [];
  for (const [i, r] of shelf.entries()) {
    const itemId = itemIds.get(`${r.source}:${r.sourceId}`);
    if (!itemId) continue;
    const unit = r.totalUnit ?? MEDIA_TYPE_META[r.mediaType].defaultUnit;
    const status = i === 0 || i === 1 ? "active" : i < 5 ? "finished" : i < 8 ? "planning" : "paused";
    const total = r.totalAmount;
    const progress = status === "finished" && total ? total : total ? Math.floor(total * between(0.15, 0.7)) : 0;
    await db
      .insert(libraryEntries)
      .values({
        userId: u.id,
        mediaItemId: itemId,
        status,
        progress,
        progressUnit: unit,
        rating: status === "finished" ? Math.round(between(6, 10)) : null,
        startedAt: status === "planning" ? null : isoDay(daysAgo(Math.round(between(20, u.historyDays)))),
        finishedAt: status === "finished" ? isoDay(daysAgo(Math.round(between(1, 20)))) : null,
        updatedAt: daysAgo(between(0, 10)),
      })
      .onConflictDoNothing();
    if (status !== "planning") entries.push({ itemId, type: r.mediaType, unit, total, progress });
  }
  if (entries.length === 0) return;

  const rows: (typeof immersionSessions.$inferInsert)[] = [];
  for (let day = u.historyDays; day >= 0; day--) {
    if (rand() < u.skipRate) continue;
    // Weekends run longer than weekdays.
    const date = daysAgo(day);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const budget = u.minutesPerDay * between(0.45, weekend ? 1.9 : 1.35);
    let left = budget;
    const blocks = Math.max(1, Math.round(between(1, 3)));
    for (let b = 0; b < blocks && left > 8; b++) {
      const minutes = Math.max(8, Math.round(b === blocks - 1 ? left : left * between(0.4, 0.8)));
      left -= minutes;
      const entry = pick(entries);
      const startedAt = new Date(date);
      startedAt.setHours(Math.round(between(8, 23)), Math.round(between(0, 59)), 0, 0);
      rows.push({
        userId: u.id,
        mediaItemId: entry.itemId,
        mediaType: entry.type,
        startedAt,
        durationSeconds: minutes * 60,
        amount: amountFor(entry.unit, minutes),
        amountUnit: entry.unit,
        createdAt: startedAt,
        updatedAt: startedAt,
      });
    }
  }

  // Chunked insert: a single statement with thousands of rows can exceed parameter limits.
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(immersionSessions).values(rows.slice(i, i + 200));
  }
  const hours = Math.round(rows.reduce((a, r) => a + r.durationSeconds, 0) / 3600);
  console.log(`  ${u.name}: ${rows.length} sessions, ${hours}h`);
}

/** Native units that roughly match the time spent, so reading speeds look sane. */
function amountFor(unit: Unit | null, minutes: number): number | null {
  switch (unit) {
    case "episodes":
      return Math.max(1, Math.round(minutes / 24));
    case "chapters":
      return Math.max(1, Math.round(minutes / 12));
    case "volumes":
      return minutes > 90 ? 1 : null;
    case "pages":
      return Math.max(1, Math.round(minutes * between(0.8, 1.4)));
    case "characters":
      return Math.round(minutes * between(160, 380));
    case "words":
      return Math.round(minutes * between(90, 160));
    case "items":
      return Math.max(1, Math.round(minutes / 5));
    default:
      return null;
  }
}

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length > 0 && out.length < n) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

// --- Social graph ---

async function seedFollows(demoIds: string[]) {
  const everyone = await db.select({ id: user.id }).from(user).where(eq(user.publicProfile, true));
  const ids = everyone.map((u) => u.id);
  const pairs: { followerId: string; followingId: string }[] = [];
  for (const follower of demoIds) {
    // Each demo member follows roughly half the community, including any real accounts.
    for (const following of ids) {
      if (following === follower) continue;
      if (rand() < 0.55) pairs.push({ followerId: follower, followingId: following });
    }
  }
  if (pairs.length > 0) await db.insert(follows).values(pairs).onConflictDoNothing();
  console.log(`Follow edges: ${pairs.length}`);
}

async function seedKudos(demoIds: string[]) {
  const recent = await db
    .select({ id: immersionSessions.id, userId: immersionSessions.userId })
    .from(immersionSessions)
    .orderBy(desc(immersionSessions.startedAt))
    .limit(120);
  const rows: { sessionId: string; userId: string }[] = [];
  for (const s of recent) {
    for (const u of demoIds) {
      if (u !== s.userId && rand() < 0.12) rows.push({ sessionId: s.id, userId: u });
    }
  }
  if (rows.length > 0) await db.insert(sessionKudos).values(rows).onConflictDoNothing();
  console.log(`Kudos: ${rows.length}`);
}

async function seedClub(users: SeededUser[], catalogue: SearchResult[], itemIds: Map<string, string>) {
  if (users.length === 0) return;
  const owner = users[0];
  const existing = await db.query.clubs.findFirst({ where: eq(clubs.name, "Visual Novel Grind") });
  if (existing) {
    console.log("Club already exists, skipping");
    return;
  }

  const [club] = await db
    .insert(clubs)
    .values({
      name: "Visual Novel Grind",
      description: "Reading one VN at a time, together. Post your character counts, keep the streak alive.",
      visibility: "public",
      tags: ["visual-novel", "reading", "intermediate"],
      coverUrl: catalogue.find((c) => c.mediaType === "visual_novel")?.coverUrl ?? null,
      joinCode: "VNGRIND",
      ownerId: owner.id,
    })
    .returning({ id: clubs.id });

  const members = users.slice(0, 6);
  await db
    .insert(clubMembers)
    .values(members.map((m, i) => ({ clubId: club.id, userId: m.id, role: i === 0 ? ("owner" as const) : ("member" as const) })))
    .onConflictDoNothing();

  const vns = catalogue.filter((c) => c.mediaType === "visual_novel").slice(0, 3);
  for (const [i, vn] of vns.entries()) {
    const itemId = itemIds.get(`${vn.source}:${vn.sourceId}`);
    if (!itemId) continue;
    const [p] = await db
      .insert(clubPicks)
      .values({
        clubId: club.id,
        mediaItemId: itemId,
        proposedBy: pick(members).id,
        status: i === 0 ? "current" : "proposed",
      })
      .returning({ id: clubPicks.id });
    const voters = sample(members, Math.round(between(2, members.length)));
    await db
      .insert(clubPickVotes)
      .values(voters.map((v) => ({ pickId: p.id, userId: v.id })))
      .onConflictDoNothing();
  }
  console.log(`Club "Visual Novel Grind": ${members.length} members, ${vns.length} picks`);
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});
