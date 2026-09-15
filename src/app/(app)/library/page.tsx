import Link from "next/link";
import { ENTRY_STATUSES, MEDIA_TYPES, type EntryStatus, type MediaType } from "@/db/schema";
import { MEDIA_TYPE_META, STATUS_LABELS } from "@/lib/media";
import { getLibrary } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { AddMediaDialog } from "@/components/library/add-media-dialog";
import { MediaCard } from "@/components/library/media-card";

export const metadata = { title: "Library" };

const STATUS_TABS: { key: EntryStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  ...ENTRY_STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s] })),
];

export default async function LibraryPage(props: PageProps<"/library">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const statusParam = str(sp.status);
  const typeParam = str(sp.type);
  const status = (ENTRY_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as EntryStatus) : undefined;
  const type = (MEDIA_TYPES as readonly string[]).includes(typeParam ?? "") ? (typeParam as MediaType) : undefined;

  const [entries, allEntries] = await Promise.all([getLibrary(user.id, status, type), status || type ? getLibrary(user.id) : null]);
  const everything = allEntries ?? entries;
  const typesInLibrary = MEDIA_TYPES.filter((t) => everything.some((e) => e.mediaItem.type === t));

  const q = (s?: string, t?: string) => {
    const p = new URLSearchParams();
    if (s && s !== "all") p.set("status", s);
    if (t) p.set("type", t);
    const qs = p.toString();
    return `/library${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader title="Library" description={`${everything.length} item${everything.length === 1 ? "" : "s"}`} actions={<AddMediaDialog />} />

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {STATUS_TABS.map((t) => {
          const active = (status ?? "all") === t.key;
          const count = t.key === "all" ? everything.length : everything.filter((e) => e.status === t.key).length;
          return (
            <Link
              key={t.key}
              href={q(t.key, type)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                active ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} <span className="ml-1 text-xs text-muted-foreground">{count}</span>
            </Link>
          );
        })}
      </div>

      {typesInLibrary.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <Link href={q(status)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", !type && "bg-muted font-medium")}>
            All types
          </Link>
          {typesInLibrary.map((t) => (
            <Link key={t} href={q(status, t)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", type === t && "bg-muted font-medium")}>
              {MEDIA_TYPE_META[t].label}
            </Link>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {everything.length === 0 ? "Your library is empty. Add an anime, a VN, a book — anything you're consuming in Japanese." : "Nothing matches this filter."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <MediaCard
              key={e.id}
              item={{
                mediaItemId: e.mediaItemId,
                title: e.mediaItem.title,
                titleNative: e.mediaItem.titleNative,
                coverUrl: e.mediaItem.coverUrl,
                type: e.mediaItem.type,
                status: e.status,
                progress: e.progress,
                progressUnit: e.progressUnit,
                totalAmount: e.mediaItem.totalAmount,
                totalUnit: e.mediaItem.totalUnit,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
