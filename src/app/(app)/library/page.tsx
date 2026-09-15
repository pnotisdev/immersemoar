import Link from "next/link";
import { Compass } from "lucide-react";
import { ENTRY_STATUSES, MEDIA_TYPES, type EntryStatus, type MediaType } from "@/db/schema";
import { MEDIA_TYPE_META, STATUS_LABELS } from "@/lib/media";
import { getLibrary } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { TabLinks } from "@/components/layout/tab-links";
import { AddMediaDialog } from "@/components/library/add-media-dialog";
import { MediaCard } from "@/components/library/media-card";

export const metadata = { title: "Library" };

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

  const statusTabs = [
    { href: q("all", type), label: "All", count: everything.length },
    ...ENTRY_STATUSES.map((s) => ({
      href: q(s, type),
      label: STATUS_LABELS[s],
      count: everything.filter((e) => e.status === s).length,
    })).filter((t) => t.count > 0 || everything.length === 0),
  ];

  return (
    <div>
      <PageHeader
        title="Library"
        description={`${everything.length} title${everything.length === 1 ? "" : "s"} tracked`}
        actions={
          <>
            <Link
              href="/discover"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors hover:bg-muted"
            >
              <Compass className="size-4" /> Discover
            </Link>
            <AddMediaDialog />
          </>
        }
      />

      <TabLinks tabs={statusTabs} active={q(status ?? "all", type)} />

      {typesInLibrary.length > 1 && (
        <TabLinks
          tabs={[
            { href: q(status), label: "All types" },
            ...typesInLibrary.map((t) => ({ href: q(status, t), label: MEDIA_TYPE_META[t].label })),
          ]}
          active={q(status, type)}
          variant="pill"
          className="mb-5"
        />
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {everything.length === 0
              ? "Your library is empty. Add an anime, a VN, a book — anything you're consuming in Japanese."
              : "Nothing matches this filter."}
          </p>
          {everything.length === 0 && (
            <Link
              href="/discover"
              className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground"
            >
              <Compass className="size-4" /> Browse popular titles
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
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
                rating: e.rating,
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
