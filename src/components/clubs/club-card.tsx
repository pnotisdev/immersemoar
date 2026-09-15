import Link from "next/link";
import { Globe, Lock, Users } from "lucide-react";
import type { ClubVisibility } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

export interface ClubCardData {
  id: string;
  name: string;
  description: string | null;
  visibility: ClubVisibility;
  tags: string[];
  coverUrl: string | null;
  members: number;
  role?: "owner" | "member";
}

export function ClubCard({ club }: { club: ClubCardData }) {
  return (
    <Link href={`/clubs/${club.id}`} className="group flex flex-col overflow-hidden rounded-xl border transition-colors hover:bg-muted/40">
      <div className="relative h-24 bg-muted">
        {club.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium">
          {club.visibility === "private" ? <Lock className="size-3" /> : <Globe className="size-3" />}
          {club.visibility === "private" ? "Private" : "Public"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight group-hover:underline">{club.name}</h3>
          {club.role && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {club.role === "owner" ? "Owner" : "Member"}
            </Badge>
          )}
        </div>
        {club.description && <p className="line-clamp-2 text-sm text-muted-foreground">{club.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" /> {club.members}/100
          </span>
          {club.tags.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">
              {t}
            </Badge>
          ))}
          {club.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{club.tags.length - 3}</span>}
        </div>
      </div>
    </Link>
  );
}
