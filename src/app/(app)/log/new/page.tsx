import { requireUser } from "@/lib/session";
import { getLibraryPicksWithStats } from "@/lib/view-models";
import { PageHeader } from "@/components/layout/page-header";
import { QuickLogFlow } from "@/components/sessions/quick-log-flow";

export const metadata = { title: "Log immersion" };

export default async function NewLogPage() {
  const user = await requireUser();
  const picks = await getLibraryPicksWithStats(user.id);
  return (
    <div>
      <PageHeader title="Log your immersion" description="Pick a medium, find the title, fill in the details. New titles are added to your library automatically." />
      <QuickLogFlow picks={picks} tz={user.timezone ?? "UTC"} />
    </div>
  );
}
