import Link from "next/link";
import { Suspense } from "react";
import { subDays } from "date-fns";
import { BarChart3, BookOpen, Timer, Trophy, Users } from "lucide-react";
import { formatCompact, formatNumber } from "@/lib/format";
import { getCommunityPulse } from "@/lib/social-queries";
import { getShelves } from "@/lib/sources/browse";
import { Poster } from "@/components/media/poster";

export const metadata = {
  title: "immersemoar — track every hour of Japanese you consume",
  description:
    "Anime, manga, visual novels, books, podcasts — one tracker for everything you read and watch in Japanese, with hours, streaks, levels, goals and a leaderboard.",
};

const FEATURES = [
  {
    icon: Timer,
    title: "One timer, every medium",
    body: "Start a timer or backdate a session. Episodes, chapters, pages, characters — logged in the units that make sense, and always in hours too.",
  },
  {
    icon: BookOpen,
    title: "A library that fills itself",
    body: "Search AniList, VNDB, TMDB and Google Books. Covers, Japanese titles and lengths come along; progress updates as you log.",
  },
  {
    icon: BarChart3,
    title: "Stats that actually answer things",
    body: "Reading vs listening, characters per hour, streaks, heatmaps, month-over-month — and goals with an on-pace marker.",
  },
  {
    icon: Trophy,
    title: "A leaderboard worth climbing",
    body: "Global and per-medium rankings by week, month or year. Or rank yourself only against the people you follow.",
  },
  {
    icon: Users,
    title: "People doing the same thing",
    body: "Follow other learners, see their sessions in your feed, give kudos, and join clubs that read something together.",
  },
];

export default async function LandingPage() {
  const pulse = await getCommunityPulse(subDays(new Date(), 7));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <span className="font-semibold tracking-tight">
            immerse<span className="text-muted-foreground">moar</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pt-14 pb-10 sm:pt-20">
          <h1 className="max-w-3xl text-3xl leading-tight font-semibold sm:text-5xl">
            Every hour of Japanese you consume, in one place.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Anime, manga, visual novels, light novels, books, YouTube, podcasts — track the time, keep the streak, watch
            the level climb, and see where you land against everyone else doing the same.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start tracking — it&rsquo;s free
            </Link>
            <Link href="/login" className="rounded-full border px-5 py-2.5 text-sm transition-colors hover:bg-muted">
              I already have an account
            </Link>
          </div>

          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            <Pulse value={formatNumber(pulse.members)} label="members" />
            <Pulse value={formatCompact(Math.round(pulse.secondsThisWeek / 3600))} label="hours logged this week" />
            <Pulse value={formatNumber(pulse.sessionsThisWeek)} label="sessions this week" />
          </dl>
        </section>

        <Suspense fallback={<div className="h-44 sm:h-56" />}>
          <PosterWall />
        </Suspense>

        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="section-label mb-6">What you get</h2>
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20">
          <div className="rounded-2xl border bg-surface px-6 py-10 text-center sm:px-10">
            <h2 className="text-xl font-semibold sm:text-2xl">Start with tonight&rsquo;s episode.</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Create an account, add what you&rsquo;re watching or reading, and hit start. Everything else — XP, streaks,
              rankings, clubs — builds itself from there.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Create your account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-xs text-muted-foreground">
          <span>
            immerse<span className="opacity-60">moar</span>
          </span>
          <span>Cover art and metadata from AniList, VNDB, TMDB and Google Books.</span>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/login" className="ml-auto hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Pulse({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

/** Two rows of real cover art — the fastest way to say what this app is for. */
async function PosterWall() {
  const shelves = await getShelves(["anime", "manga", "visual_novel"]);
  const items = shelves.flatMap((s) => s.items).filter((i) => i.coverUrl);
  if (items.length === 0) return null;
  const rows = [items.filter((_, i) => i % 2 === 0).slice(0, 14), items.filter((_, i) => i % 2 === 1).slice(0, 14)];

  return (
    <section aria-hidden className="overflow-hidden py-2">
      <div className="[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] grid gap-3">
        {rows.map((row, i) => (
          <div key={i} className={`flex gap-3 ${i === 1 ? "-ml-14" : ""}`}>
            {row.map((item) => (
              <div key={`${item.source}:${item.sourceId}`} className="w-24 shrink-0 sm:w-28">
                <Poster src={item.coverUrl} title={item.title} type={item.mediaType} sizes="112px" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
