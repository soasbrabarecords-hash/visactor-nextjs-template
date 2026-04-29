import { clampNumber } from "./intelligence";
import type { ChartMovementRecord } from "./movements";

export type GenreHeatInsight = {
  genre: string;
  genreLabel: string;
  genreHeatScore: number;
  opportunityCount: number;
  trackCount: number;
  leaderTrackId: string | null;
  leaderTrackName: string | null;
  leaderCoverUrl: string | null;
};

export type ArtistDominanceInsight = {
  artistName: string;
  top20Count: number;
  top50Count: number;
  averagePopularity: number;
  averageOpportunityScore: number;
  dominanceScore: number;
  tags: string[];
  genres: string[];
};

function uniqueGenres(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildGenreHeatInsights({
  movements,
  getGenreLabel,
}: {
  movements: ChartMovementRecord[];
  getGenreLabel: (genre: string) => string;
}) {
  const genreMap = new Map<string, ChartMovementRecord[]>();

  for (const movement of movements) {
    const genreKey = movement.genre || "all";
    const bucket = genreMap.get(genreKey);

    if (bucket) {
      bucket.push(movement);
    } else {
      genreMap.set(genreKey, [movement]);
    }
  }

  return Array.from(genreMap.entries())
    .map(([genre, tracks]) => {
      const rankedTracks = [...tracks].sort(
        (left, right) => right.opportunityScore - left.opportunityScore,
      );
      const topTracks = rankedTracks.slice(0, 20);
      const opportunityCount = tracks.filter(
        (track) => track.opportunityScore >= 75,
      ).length;
      const averageScore =
        topTracks.length > 0
          ? topTracks.reduce((sum, track) => sum + track.opportunityScore, 0) /
            topTracks.length
          : 0;

      return {
        genre,
        genreLabel: getGenreLabel(genre),
        genreHeatScore: clampNumber(Math.round(averageScore), 0, 100),
        opportunityCount,
        trackCount: tracks.length,
        leaderTrackId: rankedTracks[0]?.trackId ?? null,
        leaderTrackName: rankedTracks[0]?.trackName ?? null,
        leaderCoverUrl: rankedTracks[0]?.imageUrl ?? null,
      } satisfies GenreHeatInsight;
    })
    .filter((genre) => genre.genre !== "all" || genreMap.size === 1)
    .sort((left, right) => right.genreHeatScore - left.genreHeatScore);
}

export function buildArtistDominanceInsights(movements: ChartMovementRecord[]) {
  const artistMap = new Map<string, ChartMovementRecord[]>();

  for (const movement of movements) {
    const leadArtist = movement.artistName.split(",")[0]?.trim() || movement.artistName;
    const bucket = artistMap.get(leadArtist);

    if (bucket) {
      bucket.push(movement);
    } else {
      artistMap.set(leadArtist, [movement]);
    }
  }

  return Array.from(artistMap.entries())
    .map(([artistName, tracks]) => {
      const top20Count = tracks.filter((track) => track.currentRank <= 20).length;
      const top50Count = tracks.filter((track) => track.currentRank <= 50).length;
      const averagePopularity =
        tracks.reduce((sum, track) => sum + track.popularityCurrent, 0) /
        Math.max(tracks.length, 1);
      const averageOpportunityScore =
        tracks.reduce((sum, track) => sum + track.opportunityScore, 0) /
        Math.max(tracks.length, 1);
      const dominanceScore = clampNumber(
        Math.round(top50Count * 12 + averagePopularity * 0.45 + averageOpportunityScore * 0.4),
        0,
        100,
      );
      const genres = uniqueGenres(tracks.flatMap((track) => track.genreHints));
      const growingGenres = uniqueGenres(
        tracks
          .filter(
            (track) =>
              track.movementType === "up" ||
              track.movementType === "new" ||
              track.movementType === "reentry",
          )
          .flatMap((track) => track.genreHints),
      );
      const tags = [
        top20Count >= 3 ? "Dominando o chart" : null,
        growingGenres.length > 1 ? "Expansao de mercado" : null,
      ].filter((tag): tag is string => Boolean(tag));

      return {
        artistName,
        top20Count,
        top50Count,
        averagePopularity: Math.round(averagePopularity),
        averageOpportunityScore: Math.round(averageOpportunityScore),
        dominanceScore,
        tags,
        genres,
      } satisfies ArtistDominanceInsight;
    })
    .sort((left, right) => right.dominanceScore - left.dominanceScore);
}

export function applyArtistIntelligenceTags({
  movements,
  artists,
}: {
  movements: ChartMovementRecord[];
  artists: ArtistDominanceInsight[];
}) {
  const artistMap = new Map(artists.map((artist) => [artist.artistName, artist] as const));

  return movements.map((movement) => {
    const leadArtist = movement.artistName.split(",")[0]?.trim() || movement.artistName;
    const artist = artistMap.get(leadArtist);
    const nextTags = new Set(movement.intelligenceTags);

    for (const tag of artist?.tags ?? []) {
      nextTags.add(tag);
    }

    return {
      ...movement,
      intelligenceTags: Array.from(nextTags),
    };
  });
}
