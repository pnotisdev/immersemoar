import type { ReactNode } from "react";
import { ENTRY_STATUSES, MEDIA_TYPES, type EntryStatus, type MediaType } from "@/db/schema";
import { MEDIA_TYPE_META, STATUS_LABELS } from "@/lib/media";
import { getLibrary } from "@/lib/queries";
import { TabLinks } from "@/components/layout/tab-links";
import { MediaCard } from "@/components/library/media-card";

/**
 * The status/type-filtered grid shared by "my library" and "someone's library"
 * (viewed from their profile) — same browsing UX, different `userId`.
 */
export async function LibraryBrowser({
  userId,
  basePath,
  status,
  type,
  emptyState,
}: {
  userId: string;
  /** e.g. "/library" or "/u/mika/library" — filter links are built from this. */
  basePath: string;
  status?: EntryStatus;
  type?: MediaType;
  /** Shown only when the library has zero entries at all (not just for this filter). */
  emptyState: ReactNode;
}) {
  const [entries, allEntries] = await Promise.all([
    getLibrary(userId, status, type),
    status || type ? getLibrary(userId) : null,
  ]);
  const everything = allEntries ?? entries;
  const typesInLibrary = MEDIA_TYPES.filter((t) => everything.some((e) => e.mediaItem.type === t));

  const q = (s?: string, t?: string) => {
    const p = new URLSearchParams();
    if (s && s !== "all") p.set("status", s);
    if (t) p.set("type", t);
    const qs = p.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
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
        everything.length === 0 ? (
          emptyState
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <p className="text-sm text-muted-foreground">Nothing matches this filter.</p>
          </div>
        )
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
