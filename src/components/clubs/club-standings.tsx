import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { getMyClubStandings } from "@/lib/club-queries";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Standing = Awaited<ReturnType<typeof getMyClubStandings>>[number];

export function ClubStandings({ standings }: { standings: Standing[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Club ranking</CardTitle>
        <CardDescription>Where you stand among your club members this month</CardDescription>
        <CardAction>
          <Button render={<Link href="/clubs" />} nativeButton={false} variant="ghost" size="sm">
            Clubs
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {standings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re not in a club yet.{" "}
            <Link href="/clubs" className="underline underline-offset-4">
              Find one
            </Link>{" "}
            or start your own.
          </p>
        ) : (
          <ul className="grid gap-2">
            {standings.map((s) => (
              <li key={s.club.id} className="flex items-center gap-3 text-sm">
                <Link href={`/clubs/${s.club.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {s.club.name}
                </Link>
                <span className="tabular-nums text-muted-foreground">{formatDuration(s.seconds)}</span>
                <span className="w-16 text-right font-semibold tabular-nums">
                  {s.rank ? `#${s.rank}` : "—"}
                  <span className="text-xs font-normal text-muted-foreground"> / {s.total}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
