import type { EntryStatus, GoalMetric, MediaSource, MediaType, Unit } from "@/db/schema";

/** Reading vs listening: anything with audio counts as listening (anime, video, podcasts); text media as reading. */
export type MediaGroup = "reading" | "listening" | "other";
export const GROUP_LABELS: Record<MediaGroup, string> = { reading: "Reading", listening: "Listening", other: "Other" };

export interface MediaTypeMeta {
  label: string;
  group: MediaGroup;
  /** Suggested unit for sessions/progress. null = time only. */
  defaultUnit: Unit | null;
  /** Which external source can search this type. null = manual entry only. */
  searchSource: Exclude<MediaSource, "manual"> | null;
}

export const MEDIA_TYPE_META: Record<MediaType, MediaTypeMeta> = {
  anime: { label: "Anime", group: "listening", defaultUnit: "episodes", searchSource: "anilist" },
  manga: { label: "Manga", group: "reading", defaultUnit: "chapters", searchSource: "anilist" },
  light_novel: { label: "Light novel", group: "reading", defaultUnit: "pages", searchSource: "anilist" },
  visual_novel: { label: "Visual novel", group: "reading", defaultUnit: "characters", searchSource: "vndb" },
  movie: { label: "Movie", group: "listening", defaultUnit: null, searchSource: "tmdb" },
  series: { label: "Series", group: "listening", defaultUnit: "episodes", searchSource: "tmdb" },
  book: { label: "Book", group: "reading", defaultUnit: "pages", searchSource: "google_books" },
  graded_reader: { label: "Graded reader", group: "reading", defaultUnit: "pages", searchSource: "google_books" },
  youtube: { label: "YouTube", group: "listening", defaultUnit: null, searchSource: null },
  podcast: { label: "Podcast", group: "listening", defaultUnit: null, searchSource: null },
  drama_cd: { label: "Drama CD", group: "listening", defaultUnit: null, searchSource: null },
  game: { label: "Game", group: "other", defaultUnit: null, searchSource: null },
  news: { label: "News", group: "reading", defaultUnit: "items", searchSource: null },
  other: { label: "Other", group: "other", defaultUnit: null, searchSource: null },
};

export const UNIT_LABELS: Record<Unit, string> = {
  episodes: "episodes",
  chapters: "chapters",
  volumes: "volumes",
  pages: "pages",
  characters: "characters",
  words: "words",
  items: "items",
};

export const STATUS_LABELS: Record<EntryStatus, string> = {
  planning: "Planning",
  active: "In progress",
  paused: "Paused",
  finished: "Finished",
  dropped: "Dropped",
};

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  time: "hours",
  ...UNIT_LABELS,
};

export const SOURCE_LABELS: Record<MediaSource, string> = {
  manual: "Manual",
  anilist: "AniList",
  vndb: "VNDB",
  tmdb: "TMDB",
  google_books: "Google Books",
};

export function mediaTypeLabel(type: MediaType) {
  return MEDIA_TYPE_META[type].label;
}

export function typesInGroup(group: MediaGroup): MediaType[] {
  return (Object.keys(MEDIA_TYPE_META) as MediaType[]).filter((t) => MEDIA_TYPE_META[t].group === group);
}
