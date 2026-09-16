import Link from "next/link";
import { formatDuration } from "@/lib/format";
import type { MemberRow } from "@/lib/social-queries";
import { Avatar } from "@/components/ranking/avatar";
import { FollowButton } from "./follow-button";

/** A member in the directory: who they are, how much they logged, and one action. */
export function MemberCard({ member, viewerId }: { member: MemberRow; viewerId: string }) {
  const isSelf = member.userId === viewerId;
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40">
      <Link href={`/u/${member.username}`} className="shrink-0">
        <Avatar name={member.name} image={member.image} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${member.username}`} className="truncate text-sm font-medium hover:underline">
          {member.name}
          {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">you</span>}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          Lv {member.level.level} · {formatDuration(member.seconds)}
          {member.followers > 0 && ` · ${member.followers} follower${member.followers === 1 ? "" : "s"}`}
        </p>
      </div>
      {!isSelf && <FollowButton userId={member.userId} initialFollowing={member.followedByViewer} size="sm" />}
    </div>
  );
}

/** Condensed version for the sidebar's "People to follow". */
export function MemberRowCompact({ member, viewerId }: { member: MemberRow; viewerId: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Link href={`/u/${member.username}`} className="shrink-0">
        <Avatar name={member.name} image={member.image} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${member.username}`} className="block truncate text-sm font-medium hover:underline">
          {member.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          Lv {member.level.level} · {formatDuration(member.seconds)}
        </p>
      </div>
      {member.userId !== viewerId && (
        <FollowButton userId={member.userId} initialFollowing={member.followedByViewer} size="sm" />
      )}
    </div>
  );
}
