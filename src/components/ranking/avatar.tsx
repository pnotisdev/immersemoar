import { cn } from "@/lib/utils";

/** Initials fallback avatar; uses the image when the user has one. */
export function Avatar({ name, image, size = "md", className }: { name: string; image: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const dim = { sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" }[size];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={cn("shrink-0 rounded-full object-cover", dim, className)} />
  ) : (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground", dim, className)} aria-hidden>
      {initials || "?"}
    </div>
  );
}
