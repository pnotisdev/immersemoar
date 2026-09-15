import { CLUB_TAGS } from "@/db/schema";
import { listMyClubs, listPublicClubs } from "@/lib/club-queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { TabLinks } from "@/components/layout/tab-links";
import { CommunityTabs } from "@/components/community/community-tabs";
import { ClubCard } from "@/components/clubs/club-card";
import { CreateClubButton, JoinWithCodeButton } from "@/components/clubs/club-dialogs";

export const metadata = { title: "Clubs" };

export default async function ClubsPage(props: PageProps<"/clubs">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const q = str(sp.q) ?? "";
  const tag = (CLUB_TAGS as readonly string[]).includes(str(sp.tag) ?? "") ? str(sp.tag) : undefined;

  const [mine, discover] = await Promise.all([listMyClubs(user.id), listPublicClubs({ q, tag })]);
  const mineIds = new Set(mine.map((c) => c.id));
  const others = discover.filter((c) => !mineIds.has(c.id));

  const href = (t?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (t) p.set("tag", t);
    const s = p.toString();
    return `/clubs${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Clubs"
        description="Immerse with others: club leaderboards, and vote on what to read or watch together next."
        actions={
          <>
            <JoinWithCodeButton />
            <CreateClubButton />
          </>
        }
      />
      <CommunityTabs active="/clubs" />

      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="section-label mb-3">Your clubs</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((c) => (
              <ClubCard key={c.id} club={c} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="section-label">Discover</h2>
          <form method="get" action="/clubs" className="ml-auto flex gap-2">
            {tag && <input type="hidden" name="tag" value={tag} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search clubs…"
              aria-label="Search clubs"
              className="h-8 w-52 rounded-full border bg-transparent px-3.5 text-sm outline-none focus-visible:border-ring"
            />
          </form>
        </div>
        <TabLinks
          tabs={[{ href: href(), label: "All" }, ...CLUB_TAGS.map((t) => ({ href: href(t), label: t }))]}
          active={href(tag)}
          variant="pill"
          className="mb-4"
        />
        {others.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {discover.length === 0 && !q && !tag ? "No public clubs yet — create the first one." : "No clubs match. Try another tag or search."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((c) => (
              <ClubCard key={c.id} club={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
