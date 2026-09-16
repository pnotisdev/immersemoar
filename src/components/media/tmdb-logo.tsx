/**
 * TMDB's terms require visibly attributing them wherever their data/images appear (not
 * just a text mention) — see https://www.themoviedb.org/about/logos-attribution:
 * "every application that uses our data or images is required to properly attribute
 * TMDB as the source." This hotlinks their own officially-published attribution asset
 * (the "Alt short" blue mark) rather than a locally stored copy, the same way this app
 * already references AniList/VNDB cover art by remote URL instead of downloading it.
 *
 * Used on the media page (for movie/series items sourced from TMDB) and the "Add media"
 * search dialog (whose Movies/Series tab searches TMDB — see src/lib/sources/tmdb.ts).
 */
const LOGO_URL = "https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg";

export function TmdbLogo({ className }: { className?: string }) {
  // Fixed, trusted first-party brand asset URL, not user content — not worth a
  // next/image remote-SVG config change (dangerouslyAllowSVG) for one small logo.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_URL} alt="The Movie Database" className={className} />;
}
