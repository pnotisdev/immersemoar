import Image from "next/image";
import { subDays } from "date-fns";
import { formatCompact, formatNumber } from "@/lib/format";
import { getCommunityPulse } from "@/lib/social-queries";

const HIGHLIGHTS = [
  {
    title: "Every minute, counted",
    body: "Log a session and watch it turn into XP, streaks, and a level that actually moves.",
    tag: "Time-based XP",
  },
  {
    title: "One tracker, every format",
    body: "Anime, VNs, manga, podcasts — AniList, VNDB, and TMDB search built in.",
    tag: "Covers and lengths included",
  },
];

export async function AuthVisual() {
  const pulse = await getCommunityPulse(subDays(new Date(), 7));

  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-black lg:block">
      <Image src="/auth/mt-fuji.jpg" alt="" fill priority sizes="50vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/50" />

      <div className="relative flex h-full flex-col justify-end gap-10 p-14">
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Immersion, tracked properly.</h2>
          <p className="mt-3 text-white/70">
            Log time, watch XP add up, and see where you land on the rankings.
          </p>
          {/* Live numbers: a signup page is a better place for proof than for promises. */}
          <p className="mt-4 text-sm text-white/60">
            <span className="font-medium text-white">{formatNumber(pulse.members)}</span> members ·{" "}
            <span className="font-medium text-white">{formatCompact(Math.round(pulse.secondsThisWeek / 3600))}</span>{" "}
            hours logged this week
          </p>
        </div>

        <div className="grid gap-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-xl border border-white/10 bg-white/[0.08] p-5 backdrop-blur-sm">
              <p className="font-medium text-white">{h.title}</p>
              <p className="mt-1.5 text-sm text-white/70">{h.body}</p>
              <span className="mt-3 inline-block rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80">
                {h.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      <a
        href="https://unsplash.com/@flvision_"
        target="_blank"
        rel="noreferrer"
        className="absolute right-3 bottom-3 text-[11px] text-white/40 hover:text-white/70"
      >
        Photo by Flavio Mori on Unsplash
      </a>
    </div>
  );
}
