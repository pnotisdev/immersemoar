import { adminListClubs, adminListSessionNotes, adminListUsers } from "@/lib/admin-queries";
import { requireAdmin } from "@/lib/admin";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { ClubsList, SessionNotesList, UsersTable } from "@/components/admin/admin-panels";

export const metadata = { title: "Admin" };

/** Admin-only moderation and user management. 404s for non-admins (see requireAdmin). */
export default async function AdminPage(props: PageProps<"/admin">) {
  const admin = await requireAdmin();
  const sp = await props.searchParams;
  const q = str(sp.q)?.trim();

  const [users, sessions, clubs] = await Promise.all([adminListUsers({ q }), adminListSessionNotes(), adminListClubs()]);

  return (
    <div className="grid gap-8">
      <PageHeader title="Admin" description="Moderation and user management — only visible to admins." />

      <section>
        <SectionHeader title="Users" />
        <form method="get" action="/admin" className="mb-3">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email…"
            aria-label="Search users"
            className="h-8 w-64 rounded-full border bg-transparent px-3.5 text-sm outline-none focus-visible:border-ring"
          />
        </form>
        <UsersTable users={users} viewerId={admin.id} />
      </section>

      <section>
        <SectionHeader title="Session notes" />
        <p className="mb-3 text-sm text-muted-foreground">Most recent sessions with a note attached, across all users.</p>
        <SessionNotesList sessions={sessions} />
      </section>

      <section>
        <SectionHeader title="Clubs" />
        <p className="mb-3 text-sm text-muted-foreground">All clubs. Hiding one removes it from public discovery and non-members.</p>
        <ClubsList clubs={clubs} />
      </section>
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
