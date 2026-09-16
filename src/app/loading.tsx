export default function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
