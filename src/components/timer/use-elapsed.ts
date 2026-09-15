"use client";

import { useEffect, useState } from "react";

/**
 * Seconds elapsed since `startedAt`, ticking once per second.
 * Renders 0 during SSR/hydration (server and client would otherwise disagree on "now"),
 * then snaps to the real value on mount.
 */
export function useElapsed(startedAt: Date | string | null) {
  const startMs = startedAt ? new Date(startedAt).getTime() : null;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startMs == null) return;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return startMs == null ? 0 : elapsed;
}
