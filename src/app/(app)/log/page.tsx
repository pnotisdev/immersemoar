import { Suspense } from "react";
import { formatDuration } from "@/lib/format";
import { getSessionsInRange } from "@/lib/queries";
import { resolveRange } from "@/lib/range-params";
import { requireUser } from "@/lib/session";
import { getLibraryPicks } from "@/lib/view-models";
import { PageHeader } from "@/components/layout/page-header";
import { LogSessionButton } from "@/components/sessions/log-session-button";
import { SessionList } from "@/components/sessions/session-list";
import { toSessionView } from "@/components/sessions/types";
import { RangePicker } from "@/components/stats/range-picker";

export const metadata = { title: "Log" };

export default async function LogPage(props: PageProps<"/log">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const sp = await props.searchParams;
  const range = resolveRange(
    { range: str(sp.range), from: str(sp.from), to: str(sp.to) },
    tz,
    "30d",
  );

  const [picks, sessions] = await Promise.all([getLibraryPicks(user.id), getSessionsInRange(user.id, range.from, range.to)]);
  const total = sessions.reduce((a, s) => a + s.durationSeconds, 0);

  return (
    <div>
      <PageHeader
        title="Log"
        description={`${range.label} · ${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${formatDuration(total)}`}
        actions={<LogSessionButton entries={picks} tz={tz} />}
      />
      <div className="mb-6">
        <Suspense>
          <RangePicker current={range.preset} from={range.fromKey} to={range.toKey} />
        </Suspense>
      </div>
      <SessionList sessions={sessions.map(toSessionView)} entries={picks} tz={tz} emptyText="No sessions in this range." />
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
