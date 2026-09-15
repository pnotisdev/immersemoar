import { presetRange } from "@/lib/dates";
import { listMembers } from "@/lib/social-queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { TabLinks } from "@/components/layout/tab-links";
import { CommunityTabs } from "@/components/community/community-tabs";
import { MemberCard } from "@/components/community/member-card";

export const metadata = { title: "Members" };

export default async function MembersPage(props: PageProps<"/members">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const sp = await props.searchParams;
  const sort = str(sp.sort) === "new" ? "new" : "active";
  const q = (str(sp.q) ?? "").trim();

  const month = presetRange("month", tz, new Date());
  const members = await listMembers(user.id, { since: month.from, sort, q: q || undefined });

  const href = (s: string) => {
    const p = new URLSearchParams();
    if (s !== "active") p.set("sort", s);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/members${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Members" description="Everyone tracking their Japanese here. Follow a few and their sessions show up in your feed." />
      <CommunityTabs active="/members" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <TabLinks
          tabs={[
            { href: href("active"), label: "Most active" },
            { href: href("new"), label: "Newest" },
          ]}
          active={href(sort)}
          variant="pill"
        />
        <form method="get" action="/members" className="flex gap-2">
          {sort !== "active" && <input type="hidden" name="sort" value={sort} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search members…"
            aria-label="Search members"
            className="h-8 w-48 rounded-full border bg-transparent px-3.5 text-sm outline-none focus-visible:border-ring"
          />
        </form>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        Time shown is what each member logged this month.
      </p>

      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {q ? `Nobody matches “${q}”.` : "No public profiles yet."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberCard key={m.userId} member={m} viewerId={user.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
