"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { addFromSearch, addManual } from "@/actions/library";
import { ENTRY_STATUSES, MEDIA_TYPES, UNITS, type EntryStatus, type MediaType, type Unit } from "@/db/schema";
import { MEDIA_TYPE_META, SOURCE_LABELS, STATUS_LABELS, UNIT_LABELS } from "@/lib/media";
import type { SearchResponse, SearchResult } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TYPE_ITEMS: Record<string, string> = Object.fromEntries(MEDIA_TYPES.map((t) => [t, MEDIA_TYPE_META[t].label]));
const STATUS_ITEMS: Record<string, string> = { ...STATUS_LABELS };
const NONE = "__none__";
const UNIT_ITEMS: Record<string, string> = { [NONE]: "no unit", ...UNIT_LABELS };

export function AddMediaDialog({ defaultType = "anime" }: { defaultType?: MediaType }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Add media
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add to library</DialogTitle>
            <DialogDescription>Search AniList, VNDB, TMDB or Google Books, or add something by hand.</DialogDescription>
          </DialogHeader>
          {open && <AddMediaBody defaultType={defaultType} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddMediaBody({ defaultType, onDone }: { defaultType: MediaType; onDone: () => void }) {
  const [type, setType] = useState<MediaType>(defaultType);
  const [status, setStatus] = useState<EntryStatus>("planning");
  const searchable = MEDIA_TYPE_META[type].searchSource !== null;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="add-type">Type</Label>
          <Select items={TYPE_ITEMS} value={type} onValueChange={(v) => setType(v as MediaType)}>
            <SelectTrigger id="add-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {MEDIA_TYPE_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-status">Status</Label>
          <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as EntryStatus)}>
            <SelectTrigger id="add-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue={searchable ? "search" : "manual"} key={searchable ? "s" : "m"}>
        <TabsList>
          <TabsTrigger value="search" disabled={!searchable}>
            Search {searchable && `(${SOURCE_LABELS[MEDIA_TYPE_META[type].searchSource!]})`}
          </TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
        </TabsList>
        <TabsContent value="search" className="pt-3">
          <SearchTab type={type} status={status} onDone={onDone} />
        </TabsContent>
        <TabsContent value="manual" className="pt-3">
          <ManualTab key={type} type={type} status={status} onDone={onDone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SearchTab({ type, status, onDone }: { type: MediaType; status: EntryStatus; onDone: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);

  const active = q.trim().length >= 2;

  // Debounced search against our own API (keys stay server-side).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = (await res.json()) as SearchResponse;
        setResults(data.results ?? []);
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
  }, [q, type]);

  function add(r: SearchResult) {
    setAddingId(r.sourceId);
    startTransition(async () => {
      const res = await addFromSearch(r, status);
      setAddingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Added “${r.title}”`);
      onDone();
      router.push(`/media/${res.data.mediaItemId}`);
    });
  }

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus placeholder={`Search ${MEDIA_TYPE_META[type].label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>
      {active && warning && <p className="text-sm text-muted-foreground">{warning}</p>}
      {active && loading && <p className="text-sm text-muted-foreground">Searching…</p>}
      {active && !loading && results.length === 0 && !warning && (
        <p className="text-sm text-muted-foreground">No results. Try the Manual tab.</p>
      )}
      <ul className="grid gap-1">
        {(active ? results : []).map((r) => (
          <li key={r.sourceId} className="flex items-center gap-3 rounded-md p-1.5 hover:bg-muted/50">
            <div className="h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-muted">
              {r.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {r.titleNative && <span lang="ja">{r.titleNative} · </span>}
                {r.year ?? "—"}
                {r.totalAmount && r.totalUnit && ` · ${r.totalAmount} ${UNIT_LABELS[r.totalUnit]}`}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => add(r)} disabled={pending}>
              {addingId === r.sourceId ? "Adding…" : "Add"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ManualTab({ type, status, onDone }: { type: MediaType; status: EntryStatus; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [unit, setUnit] = useState<Unit | null>(MEDIA_TYPE_META[type].defaultUnit);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    startTransition(async () => {
      const res = await addManual({
        type,
        status,
        title: get("title"),
        titleNative: get("titleNative"),
        coverUrl: get("coverUrl"),
        year: get("year") === "" ? "" : Number(get("year")),
        totalAmount: get("totalAmount") === "" ? "" : Number(get("totalAmount")),
        totalUnit: unit ?? "",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Added to library");
      onDone();
      router.push(`/media/${res.data.mediaItemId}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="m-title">Title</Label>
        <Input id="m-title" name="title" required maxLength={500} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="m-native">Japanese title (optional)</Label>
        <Input id="m-native" name="titleNative" lang="ja" maxLength={500} />
      </div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="m-cover">Cover image URL (optional)</Label>
          <Input id="m-cover" name="coverUrl" type="url" placeholder="https://…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="m-year">Year</Label>
          <Input id="m-year" name="year" type="number" min={1800} max={2200} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="m-total">Total length (optional)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input id="m-total" name="totalAmount" type="number" min={1} placeholder="e.g. 12" />
          <Select items={UNIT_ITEMS} value={unit ?? NONE} onValueChange={(v) => setUnit(v === NONE ? null : (v as Unit))}>
            <SelectTrigger aria-label="Unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>no unit</SelectItem>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {UNIT_LABELS[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to library"}
        </Button>
      </div>
    </form>
  );
}
