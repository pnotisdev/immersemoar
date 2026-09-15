import { MEDIA_TYPES } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { PERIOD_LABELS, RANKING_PERIODS, type RankingPeriod, type RankingScope } from "@/lib/ranking-params";
import { TabLinks } from "@/components/layout/tab-links";

const SCOPES: { key: RankingScope; label: string }[] = [
  { key: "all", label: "All media" },
  { key: "reading", label: "Reading" },
  { key: "listening", label: "Listening" },
  ...MEDIA_TYPES.map((t) => ({ key: t as RankingScope, label: MEDIA_TYPE_META[t].label })),
];

export type RankingAudience = "everyone" | "following";

/** Link-based filters so the page stays a plain server render. */
export function RankingFilters({
  basePath,
  period,
  scope,
  audience,
}: {
  basePath: string;
  period: RankingPeriod;
  scope: RankingScope;
  audience: RankingAudience;
}) {
  const href = (p: RankingPeriod, s: RankingScope, a: RankingAudience) => {
    const q = new URLSearchParams();
    if (p !== "month") q.set("period", p);
    if (s !== "all") q.set("scope", s);
    if (a !== "everyone") q.set("audience", a);
    const qs = q.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabLinks
          tabs={RANKING_PERIODS.map((p) => ({ href: href(p, scope, audience), label: PERIOD_LABELS[p] }))}
          active={href(period, scope, audience)}
          variant="pill"
        />
        <TabLinks
          tabs={[
            { href: href(period, scope, "everyone"), label: "Everyone" },
            { href: href(period, scope, "following"), label: "Following" },
          ]}
          active={href(period, scope, audience)}
          variant="pill"
          className="sm:flex-none"
        />
      </div>
      <TabLinks
        tabs={SCOPES.map((s) => ({ href: href(period, s.key, audience), label: s.label }))}
        active={href(period, scope, audience)}
        variant="pill"
      />
    </div>
  );
}
