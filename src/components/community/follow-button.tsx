"use client";

import { useState, useTransition } from "react";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { followUser, unfollowUser } from "@/actions/social";
import { cn } from "@/lib/utils";

/** Optimistic follow toggle. Reverts and explains itself if the action fails. */
export function FollowButton({
  userId,
  initialFollowing,
  size = "default",
  className,
}: {
  userId: string;
  initialFollowing: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const res = next ? await followUser(userId) : await unfollowUser(userId);
      if (!res.ok) {
        setFollowing(!next);
        toast.error(res.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-colors disabled:opacity-60",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-sm",
        following
          ? "border-border bg-transparent text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          : "border-transparent bg-primary text-primary-foreground hover:opacity-90",
        className,
      )}
    >
      {following ? <Check className="size-3.5" /> : <UserPlus className="size-3.5" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
