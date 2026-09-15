"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { addFromSearch } from "@/actions/library";
import { createSession } from "@/actions/sessions";
import type { MediaType, Unit } from "@/db/schema";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import { formatCompact, formatDuration } from "@/lib/format";
import { MEDIA_TYPE_META, SOURCE_LABELS, UNIT_LABELS } from "@/lib/media";
import type { SearchResponse, SearchResult } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LibraryPick } from "@/components/library/types";
import { AmountInput } from "./amount-input";

export type PickWithStats = LibraryPick & {
  seconds: number;
  sessions: number;
  progress: number;
  totalAmount: number | null;
  totalUnit: Unit | null;
};

interface Selected {
  mediaItemId: string | null;
  title: string;
  titleNative: string | null;
  coverUrl: string | null;
  type: MediaType;
  unit: Unit | null;
  stats?: { seconds: number; sessions: number; progress: number; totalAmount: number | null; totalUnit: Unit | null };
}

/** "an anime" / "a manga" — media labels are user-facing, so the article has to agree. */
function article(label: string) {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

const TYPE_ORDER: MediaType[] = ["anime", "manga", "visual_novel", "light_novel", "book", "series", "movie", "youtube", "podcast", "drama_cd", "graded_reader", "game", "news", "other"];

export function QuickLogFlow({ picks, tz }: { picks: PickWithStats[]; tz: string }) {
  const router = useRouter();
  const [type, setType] = useState<MediaType>("anime");
  const [q, setQ] = useState("");
  const [external, setExternal] = useState<SearchResult[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [pending, startTransition] = useTransition();

  // Details
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("30");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit | null>(MEDIA_TYPE_META[type].defaultUnit);
  const [startedAt, setStartedAt] = useState(() => toLocalInputValue(new Date(Date.now() - 30 * 60_000), tz));
  const [notes, setNotes] = useState("");

  const meta = MEDIA_TYPE_META[type];
  const searchable = meta.searchSource !== null;
  const query = q.trim();

  // Library matches are instant and local.
  const libraryMatches = useMemo(() => {
    const inType = picks.filter((p) => p.type === type);
    if (!query) return inType.slice(0, 8);
    const needle = query.toLowerCase();
    return inType.filter((p) => p.title.toLowerCase().includes(needle) || p.titleNative?.toLowerCase().includes(needle)).slice(0, 8);
  }, [picks, type, query]);

  // External search, debounced.
  useEffect(() => {
    if (!searchable || query.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = (await res.json()) as SearchResponse;
        setExternal(data.results ?? []);
        setWarning(data.warning ?? null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setWarning("Search failed");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, type, searchable]);

  function pickType(t: MediaType) {
    setType(t);
    setSelected(null);
    setQ("");
    setExternal([]);
    setWarning(null);
    setUnit(MEDIA_TYPE_META[t].defaultUnit);
  }

  function chooseLibrary(p: PickWithStats) {
    setSelected({
      mediaItemId: p.mediaItemId,
      title: p.title,
      titleNative: p.titleNative,
      coverUrl: p.coverUrl,
      type: p.type,
      unit: p.progressUnit,
      stats: { seconds: p.seconds, sessions: p.sessions, progress: p.progress, totalAmount: p.totalAmount, totalUnit: p.totalUnit },
    });
    setUnit(p.progressUnit ?? MEDIA_TYPE_META[p.type].defaultUnit);
  }

  function chooseExternal(r: SearchResult) {
    startTransition(async () => {
      const res = await addFromSearch(r, "active");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSelected({
        mediaItemId: res.data.mediaItemId,
        title: r.title,
        titleNative: r.titleNative,
        coverUrl: r.coverUrl,
        type: r.mediaType,
        unit: r.totalUnit ?? MEDIA_TYPE_META[r.mediaType].defaultUnit,
        stats: { seconds: 0, sessions: 0, progress: 0, totalAmount: r.totalAmount, totalUnit: r.totalUnit },
      });
      setUnit(r.totalUnit ?? MEDIA_TYPE_META[r.mediaType].defaultUnit);
    });
  }

  function chooseFreeform() {
    setSelected({ mediaItemId: null, title: query || meta.label, titleNative: null, coverUrl: null, type, unit: meta.defaultUnit });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const durationSeconds = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
    if (durationSeconds < 60) {
      toast.error("Duration must be at least a minute");
      return;
    }
    startTransition(async () => {
      const res = await createSession({
        mediaItemId: selected.mediaItemId,
        mediaType: selected.type,
        label: selected.mediaItemId ? null : selected.title,
        startedAt: fromLocalInputValue(startedAt, tz).toISOString(),
        durationSeconds,
        amount: amount === "" ? null : Number(amount),
        amountUnit: amount === "" ? null : unit,
        notes,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Logged ${formatDuration(durationSeconds)} of ${selected.title}`);
      router.push(selected.mediaItemId ? `/media/${selected.mediaItemId}` : "/log");
      router.refresh();
    });
  }

  const maxAmount = selected?.stats?.totalAmount && selected.stats.totalUnit === unit ? Math.max(0, selected.stats.totalAmount - selected.stats.progress) : undefined;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. What did you immerse in?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => pickType(t)}
                className={cn(
                  "rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                  type === t ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {MEDIA_TYPE_META[t].label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>2. Which title?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (selected) setSelected(null);
                }}
                placeholder={searchable ? `Search your library and ${SOURCE_LABELS[meta.searchSource!]}…` : `Search your library or type a name…`}
                className="pl-8"
              />
            </div>

            {!selected && (
              <div className="grid gap-4">
                {libraryMatches.length > 0 && (
                  <ResultGroup title="In your library">
                    {libraryMatches.map((p) => (
                      <ResultRow
                        key={p.mediaItemId}
                        cover={p.coverUrl}
                        title={p.title}
                        sub={[p.titleNative, p.sessions ? `${p.sessions} session${p.sessions === 1 ? "" : "s"} · ${formatDuration(p.seconds)}` : "not logged yet"].filter(Boolean).join(" · ")}
                        onPick={() => chooseLibrary(p)}
                      />
                    ))}
                  </ResultGroup>
                )}

                {searchable && query.length >= 2 && (
                  <ResultGroup title={`From ${SOURCE_LABELS[meta.searchSource!]}`}>
                    {loading && <p className="px-1.5 text-sm text-muted-foreground">Searching…</p>}
                    {warning && <p className="px-1.5 text-sm text-muted-foreground">{warning}</p>}
                    {!loading && !warning && external.length === 0 && <p className="px-1.5 text-sm text-muted-foreground">No results.</p>}
                    {external.map((r) => (
                      <ResultRow
                        key={r.sourceId}
                        cover={r.coverUrl}
                        title={r.title}
                        sub={[r.titleNative, r.year, r.totalAmount && r.totalUnit ? `${r.totalAmount} ${UNIT_LABELS[r.totalUnit]}` : null].filter(Boolean).join(" · ")}
                        onPick={() => chooseExternal(r)}
                        disabled={pending}
                      />
                    ))}
                  </ResultGroup>
                )}

                <button type="button" onClick={chooseFreeform} className="rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50">
                  {query ? (
                    <>
                      Log “{query}” as a one-off {meta.label.toLowerCase()} without adding it to the library
                    </>
                  ) : (
                    <>
                      Log {article(meta.label)} {meta.label.toLowerCase()} without a specific title
                    </>
                  )}
                </button>
              </div>
            )}

            {selected && (
              <form onSubmit={submit} className="grid gap-4">
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span className="truncate font-medium">{selected.title}</span>
                  <button type="button" className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => setSelected(null)}>
                    change
                  </button>
                </div>

                <div className="grid gap-1.5">
                  <Label>3. How long?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours" className="pr-8" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">h</span>
                    </div>
                    <div className="relative">
                      <Input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" className="pr-8" />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">m</span>
                    </div>
                  </div>
                </div>

                <AmountInput amount={amount} unit={unit} onChange={(v) => { setAmount(v.amount); setUnit(v.unit); }} idPrefix="ql-amount" />
                {maxAmount != null && (
                  <p className="-mt-2 text-xs text-muted-foreground">
                    {selected.stats!.progress} of {selected.stats!.totalAmount} {UNIT_LABELS[unit!]} done · {maxAmount} left
                  </p>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="ql-started">When (optional — defaults to just now)</Label>
                  <Input id="ql-started" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="ql-notes">Notes (optional)</Label>
                  <Textarea id="ql-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="lg" disabled={pending}>
                    {pending ? "Saving…" : "Save log"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="grid gap-3">
                <div className="mx-auto aspect-[2/3] w-40 overflow-hidden rounded-lg bg-muted">
                  {selected.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.coverUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="text-center">
                  <div className="font-medium">{selected.title}</div>
                  {selected.titleNative && (
                    <div className="text-sm text-muted-foreground" lang="ja">
                      {selected.titleNative}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">{MEDIA_TYPE_META[selected.type].label}</div>
                </div>
                {selected.stats && (
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 text-xs font-medium">Your progress</div>
                    <dl className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Total time</dt>
                        <dd className="font-semibold">{formatDuration(selected.stats.seconds)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Sessions</dt>
                        <dd className="font-semibold">{selected.stats.sessions}</dd>
                      </div>
                      {selected.stats.totalUnit && (
                        <div className="col-span-2">
                          <dt className="text-[11px] text-muted-foreground">{UNIT_LABELS[selected.stats.totalUnit]}</dt>
                          <dd className="font-semibold">
                            {formatCompact(selected.stats.progress)}
                            {selected.stats.totalAmount ? ` / ${formatCompact(selected.stats.totalAmount)}` : ""}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pick a title to see your history with it.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 px-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="grid gap-0.5">{children}</ul>
    </div>
  );
}

function ResultRow({ cover, title, sub, onPick, disabled }: { cover: string | null; title: string; sub: string; onPick: () => void; disabled?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onPick} disabled={disabled} className="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-muted/50 disabled:opacity-50">
        <div className="h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-muted">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{sub}</div>
        </div>
      </button>
    </li>
  );
}
