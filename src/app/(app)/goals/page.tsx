import { getGoalsWithProgress } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { GoalMenu, NewGoalButton } from "@/components/goals/goal-actions";
import { GoalCard } from "@/components/goals/goal-card";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const goals = await getGoalsWithProgress(user.id, user.timezone ?? "UTC");
  const active = goals.filter((g) => g.isActive);
  const upcoming = goals.filter((g) => !g.isActive && !g.isPast);
  const past = goals.filter((g) => g.isPast);

  const section = (title: string, list: typeof goals) =>
    list.length > 0 && (
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              actions={
                <GoalMenu
                  goalId={g.id}
                  initial={{ title: g.title, metric: g.metric, mediaType: g.mediaType, target: g.target, startDate: g.startDate, endDate: g.endDate }}
                />
              }
            />
          ))}
        </div>
      </section>
    );

  return (
    <div>
      <PageHeader title="Goals" description="Hours or native units, for everything or one media type, over any period." actions={<NewGoalButton />} />
      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No goals yet. Try “1000 hours this year” or “2,000,000 characters of visual novels”.
        </div>
      ) : (
        <div className="grid gap-8">
          {section("Active", active)}
          {section("Upcoming", upcoming)}
          {section("Past", past)}
        </div>
      )}
    </div>
  );
}
