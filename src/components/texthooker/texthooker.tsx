"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plug, PlugZap, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createSession } from "@/actions/sessions";
import { formatClock, formatNumber } from "@/lib/format";
import { MEDIA_TYPE_META } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItemPicker, type PickerValue } from "@/components/library/item-picker";
import type { LibraryPick } from "@/components/library/types";

const SOURCES = {
  luna: { label: "LunaTranslator", url: "ws://localhost:2333/api/ws/text/origin", hint: "Settings → Network service: enable the HTTP/WebSocket server (default port 2333)." },
  textractor: { label: "Textractor (websocket extension)", url: "ws://localhost:6677", hint: "Install the textractor_websocket extension; it listens on port 6677." },
  custom: { label: "Custom WebSocket URL", url: "", hint: "Any server that sends one line of text per message." },
} as const;
type SourceKey = keyof typeof SOURCES;
const SOURCE_ITEMS: Record<string, string> = Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, v.label]));

const STORAGE_KEY = "immersemoar:texthooker:v1";
const AFK_OPTIONS = [60, 120, 180, 300, 600];
const AFK_ITEMS: Record<string, string> = Object.fromEntries(AFK_OPTIONS.map((s) => [String(s), `${s / 60} min`]));

interface Line {
  id: number;
  text: string;
  at: number; // ms
  chars: number;
}

/** Characters that count toward reading: everything except whitespace and punctuation. */
export function countChars(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (/[\s\p{P}\p{S}]/u.test(ch)) continue;
    n++;
  }
  return n;
}

/** Pull the text out of a message that may be plain text or a JSON envelope. */
function extractText(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (s.startsWith("{")) {
    try {
      const j = JSON.parse(s) as Record<string, unknown>;
      for (const key of ["text", "origin", "data", "content", "message", "sentence"]) {
        const v = j[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    } catch {
      /* not JSON; treat as text */
    }
  }
  return s;
}

/** Active seconds: gaps between lines count only up to the AFK limit, so idle time isn't logged. */
function activeSeconds(lines: Line[], afk: number, now: number): number {
  if (lines.length === 0) return 0;
  let total = 0;
  for (let i = 1; i < lines.length; i++) total += Math.min((lines[i].at - lines[i - 1].at) / 1000, afk);
  total += Math.min(Math.max(0, (now - lines[lines.length - 1].at) / 1000), afk);
  return Math.floor(total);
}

interface Persisted {
  source: SourceKey;
  customUrl: string;
  afk: number;
  pick: PickerValue;
  lines: Line[];
}

export function Texthooker({ entries }: { entries: LibraryPick[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [source, setSource] = useState<SourceKey>("luna");
  const [customUrl, setCustomUrl] = useState("");
  const [afk, setAfk] = useState(180);
  const [pick, setPick] = useState<PickerValue>(() => {
    const vn = entries.find((e) => e.type === "visual_novel" && e.status === "active") ?? entries.find((e) => e.type === "visual_novel");
    return { mediaItemId: vn?.mediaItemId ?? null, mediaType: "visual_novel", label: "" };
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [hydrated, setHydrated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  // Restore an in-progress hook after a reload. localStorage is only readable on the client,
  // so this has to run after hydration; deferring a tick keeps it out of the effect body itself.
  useEffect(() => {
    const restore = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const p = JSON.parse(raw) as Partial<Persisted>;
          if (p.source && p.source in SOURCES) setSource(p.source);
          if (typeof p.customUrl === "string") setCustomUrl(p.customUrl);
          if (typeof p.afk === "number") setAfk(p.afk);
          if (p.pick) setPick(p.pick);
          if (Array.isArray(p.lines) && p.lines.length) {
            setLines(p.lines);
            nextId.current = Math.max(...p.lines.map((l) => l.id)) + 1;
          }
        }
      } catch {
        /* ignore corrupt storage */
      }
      setHydrated(true);
    };
    const id = setTimeout(restore, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ source, customUrl, afk, pick, lines } satisfies Persisted));
    } catch {
      /* storage full or blocked */
    }
  }, [hydrated, source, customUrl, afk, pick, lines]);

  const url = source === "custom" ? customUrl : SOURCES[source].url;

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
  }, []);

  function connect() {
    if (!url) {
      toast.error("Enter a WebSocket URL");
      return;
    }
    disconnect();
    setStatus("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      setStatus("error");
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => setStatus("connected");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        setStatus((s) => (s === "error" ? "error" : "idle"));
      }
    };
    ws.onmessage = (ev) => {
      const text = extractText(typeof ev.data === "string" ? ev.data : "");
      if (!text) return;
      setLines((prev) => {
        // Hookers often emit the same line twice; drop exact repeats of the last line.
        if (prev.length && prev[prev.length - 1].text === text) return prev;
        return [...prev, { id: nextId.current++, text, at: Date.now(), chars: countChars(text) }];
      });
    };
  }

  useEffect(() => () => wsRef.current?.close(), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lines.length]);

  const firstAt = lines[0]?.at ?? null;
  const now = useNowTick(lines.length > 0);
  const active = useMemo(() => activeSeconds(lines, afk, now), [lines, afk, now]);
  const chars = useMemo(() => lines.reduce((a, l) => a + l.chars, 0), [lines]);
  const idle = lines.length > 0 && now - lines[lines.length - 1].at > afk * 1000;
  const charsPerHour = active > 0 ? Math.round(chars / (active / 3600)) : 0;

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function clearAll() {
    if (lines.length && !confirm("Discard all captured lines?")) return;
    setLines([]);
  }

  function save() {
    if (lines.length === 0) return;
    if (active < 60) {
      toast.error("Less than a minute of active reading; keep going or discard.");
      return;
    }
    startTransition(async () => {
      const res = await createSession({
        mediaItemId: pick.mediaItemId,
        mediaType: pick.mediaType,
        label: pick.mediaItemId ? null : pick.label || "Texthooker",
        startedAt: new Date(firstAt!).toISOString(),
        durationSeconds: active,
        amount: chars,
        amountUnit: "characters",
        notes: `${lines.length} lines via texthooker · ${formatNumber(charsPerHour)} chars/h`,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved ${formatNumber(chars)} characters · ${formatClock(active)}`);
      setLines([]);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
            <CardDescription>Runs entirely in your browser; text never leaves your machine until you save a session.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="th-source">Text hooker</Label>
              <Select items={SOURCE_ITEMS} value={source} onValueChange={(v) => setSource((v as SourceKey) ?? "luna")}>
                <SelectTrigger id="th-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCES) as SourceKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SOURCES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{SOURCES[source].hint}</p>
            </div>
            {source === "custom" ? (
              <Input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="ws://localhost:1234/path" />
            ) : (
              <code className="rounded-md bg-muted px-2 py-1 text-xs">{url}</code>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="th-afk">Pause after inactivity</Label>
              <Select items={AFK_ITEMS} value={String(afk)} onValueChange={(v) => setAfk(Number(v ?? 180))}>
                <SelectTrigger id="th-afk" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AFK_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s / 60} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Gaps longer than this between lines are not counted as reading time.</p>
            </div>
            <div className="flex items-center gap-2">
              {status === "connected" ? (
                <Button variant="outline" onClick={disconnect}>
                  <X /> Disconnect
                </Button>
              ) : (
                <Button onClick={connect} disabled={status === "connecting"}>
                  {status === "connecting" ? <Plug /> : <PlugZap />} {status === "connecting" ? "Connecting…" : "Connect"}
                </Button>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs",
                  status === "connected" ? "text-[var(--viz-good)]" : status === "error" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                <span className={cn("size-2 rounded-full", status === "connected" ? "bg-[var(--viz-good)]" : status === "error" ? "bg-destructive" : "bg-muted-foreground/50")} />
                {status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : status === "error" ? "Could not connect — is the hooker running?" : "Not connected"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reading</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemPicker entries={entries} value={pick} onChange={setPick} idPrefix="th" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Characters" value={formatNumber(chars)} />
          <Stat label="Active time" value={formatClock(active)} hint={idle ? "paused (idle)" : undefined} />
          <Stat label="Lines" value={formatNumber(lines.length)} />
          <Stat label="Speed" value={charsPerHour ? `${formatNumber(charsPerHour)}/h` : "—"} />
        </div>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <CardTitle>Captured text</CardTitle>
            <CardDescription>Click a line to remove it if the hook misfired (menus, duplicates).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div ref={listRef} className="flex-1 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-3 font-[system-ui] text-base leading-relaxed" lang="ja" style={{ maxHeight: 480 }}>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Waiting for text… start your VN with the hooker running.</p>
              ) : (
                lines.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => removeLine(l.id)}
                    className="block w-full rounded px-1 text-left hover:bg-destructive/10 hover:line-through"
                    title={`${l.chars} characters — click to remove`}
                  >
                    {l.text}
                  </button>
                ))
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={lines.length === 0 || pending}>
                <Trash2 /> Discard
              </Button>
              <Button onClick={save} disabled={lines.length === 0 || pending}>
                <Save /> {pending ? "Saving…" : `Save session (${formatNumber(chars)} chars, ${formatClock(active)})`}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Logs as {pick.mediaItemId ? "the selected item" : `a ${MEDIA_TYPE_META[pick.mediaType].label.toLowerCase()}`} with characters as the amount, so it counts toward character goals and reading speed.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Wall clock that ticks once a second while enabled; 0 during SSR so server and client render the same. */
function useNowTick(enabled: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setNow(Date.now());
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="py-3">
      <CardContent className="px-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums tracking-tight">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
