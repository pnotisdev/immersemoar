"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal rail: swipe on touch, drag or arrow buttons with a mouse, arrow keys when focused.
 *
 * The arrows only appear on pointer-fine devices and only while there is something to scroll
 * to, and a drag is swallowed before it can turn into a click on a poster.
 */
export function ScrollRail({
  children,
  label,
  className,
  /** Extra padding so the first/last tile isn't flush with the screen edge on phones. */
  edgeToEdge = true,
}: {
  children: ReactNode;
  label: string;
  className?: string;
  edgeToEdge?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= max - 2);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  function page(direction: -1 | 1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  }

  // Mouse drag. Touch keeps the browser's own momentum scrolling, which feels better.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (!drag.current.moved && Math.abs(dx) < 4) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      setDragging(true);
    }
    el.scrollLeft = drag.current.startLeft - dx;
  }

  function endDrag() {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
  }

  // A drag that ends over a poster must not open it.
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  const scrollable = !atStart || !atEnd;

  return (
    <div className={cn("group/rail relative", className)}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className={cn(
          "no-scrollbar flex snap-x gap-3 overflow-x-auto pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&>*]:snap-start",
          edgeToEdge && "-mx-4 px-4 sm:mx-0 sm:px-0",
          dragging ? "cursor-grabbing snap-none select-none" : "snap-mandatory",
        )}
      >
        {children}
      </div>

      {/* Edge hints: the content keeps going. */}
      <Fade side="left" visible={!atStart} />
      <Fade side="right" visible={!atEnd} />

      <Arrow side="left" onClick={() => page(-1)} disabled={atStart} visible={scrollable} />
      <Arrow side="right" onClick={() => page(1)} disabled={atEnd} visible={scrollable} />
    </div>
  );
}

function Fade({ side, visible }: { side: "left" | "right"; visible: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 hidden w-10 transition-opacity duration-200 sm:block",
        side === "left" ? "left-0 bg-gradient-to-r from-background" : "right-0 bg-gradient-to-l from-background",
        visible ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

function Arrow({
  side,
  onClick,
  disabled,
  visible,
}: {
  side: "left" | "right";
  onClick: () => void;
  disabled: boolean;
  visible: boolean;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      tabIndex={-1}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        // Sits over the posters, not the titles underneath them.
        "absolute top-[30%] z-20 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 text-foreground shadow-md transition-all duration-200 hover:bg-muted disabled:pointer-events-none disabled:opacity-0 sm:flex",
        side === "left" ? "-left-3" : "-right-3",
        // Visible whenever there is somewhere to scroll — hover-only arrows are easy to miss.
        visible ? "opacity-80 hover:opacity-100 group-hover/rail:opacity-100" : "opacity-0",
      )}
    >
      <Icon className="size-4.5" />
    </button>
  );
}
