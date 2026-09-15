import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A header built from the art someone actually spends time on: a few banners/covers
 * side by side, dimmed into the page. Falls back to a quiet gradient for new accounts.
 */
export function ArtBanner({
  images,
  className,
  height = "h-36 sm:h-48",
}: {
  images: string[];
  className?: string;
  height?: string;
}) {
  const art = images.filter(Boolean).slice(0, 5);

  return (
    <div className={cn("relative overflow-hidden rounded-b-2xl bg-secondary", height, className)}>
      {art.length > 0 ? (
        <div className="absolute inset-0 flex">
          {art.map((src, i) => (
            <div key={src + i} className="relative h-full flex-1">
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 20vw"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary to-secondary" />
      )}

      {/* Two scrims: one to calm the art, one to hand off to the page background. */}
      <div className="absolute inset-0 bg-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background from-10% via-background/70 via-55% to-background/5" />
    </div>
  );
}
