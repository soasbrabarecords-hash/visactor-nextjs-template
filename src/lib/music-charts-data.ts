import "server-only";

import type {
  ChannelDatum,
  ConversionDatum,
  DashboardMetric,
  ScoreBreakdown,
} from "@/types/dashboard";
import type {
  MusicChartsData,
  MusicFilterOption,
  MusicOpportunity,
  MusicTrackHighlight,
} from "@/types/music-charts";
import type {
  FeaturedPlaylistInsight,
  TrackInsight,
} from "@/types/charts";
import {
  fetchFeaturedPlaylists,
  fetchSpotifyPlaylistTracks,
  fetchSpotifyTracksByGenre,
  type SpotifyFeaturedPlaylist,
  type SpotifyTrackRecord,
} from "./spotify";

type MusicGenreOption = MusicFilterOption & {
  queries: string[];
};

type MusicMarketOption = MusicFilterOption & {
  locale: string;
};

type AggregatedTrack = {
  id: string;
  name: string;
  artists: string;
  artistIds: string[];
  albumName: string;
  popularity: number;
  playlistsCount: number;
  durationMs: number;
  explicit: boolean;
  spotifyUrl: string;
  coverUrl: string | null;
};

const MUSIC_MARKET_OPTIONS: MusicMarketOption[] = [
  { value: "BR", label: "Brasil", locale: "pt_BR" },
  { value: "US", label: "Estados Unidos", locale: "en_US" },
  { value: "MX", label: "Mexico", locale: "es_MX" },
  { value: "AR", label: "Argentina", locale: "es_AR" },
  { value: "CO", label: "Colombia", locale: "es_CO" },
  { value: "ES", label: "Espanha", locale: "es_ES" },
  { value: "PT", label: "Portugal", locale: "pt_PT" },
  { value: "FR", label: "Franca", locale: "fr_FR" },
  { value: "GB", label: "Reino Unido", locale: "en_GB" },
];

const MUSIC_GENRE_OPTIONS: MusicGenreOption[] = [
  { value: "all", label: "Todos os generos", queries: [] },
  { value: "trap", label: "Trap", queries: ['genre:"trap"', "trap"] },
  { value: "rap", label: "Rap", queries: ['genre:"rap"', "rap"] },
  {
    value: "hip-hop",
    label: "Hip Hop",
    queries: ['genre:"hip hop"', '"hip hop"'],
  },
  { value: "funk", label: "Funk", queries: ['genre:"funk"', "funk"] },
  { value: "phonk", label: "Phonk", queries: ['genre:"phonk"', "phonk"] },
  { value: "pop", label: "Pop", queries: ['genre:"pop"', "pop"] },
  { value: "latin", label: "Latin", queries: ['genre:"latin"', "latin"] },
  {
    value: "reggaeton",
    label: "Reggaeton",
    queries: ['genre:"reggaeton"', "reggaeton"],
  },
  {
    value: "electronic",
    label: "Electronic",
    queries: ['genre:"electronic"', "electronic"],
  },
  { value: "house", label: "House", queries: ['genre:"house"', "house"] },
  { value: "indie", label: "Indie", queries: ['genre:"indie"', "indie"] },
  { value: "r-n-b", label: "R&B", queries: ['genre:"r-n-b"', '"r&b"'] },
  { value: "samba", label: "Samba", queries: ['genre:"samba"', "samba"] },
  { value: "pagode", label: "Pagode", queries: ['genre:"pagode"', "pagode"] },
  {
    value: "sertanejo",
    label: "Sertanejo",
    queries: ['genre:"sertanejo"', "sertanejo"],
  },
];

const MARKET_PROBE_QUERIES: Record<string, string[]> = {
  BR: [
    'genre:"trap"',
    'genre:"rap"',
    'genre:"funk"',
    'genre:"pop"',
    'genre:"sertanejo"',
  ],
  US: [
    'genre:"hip hop"',
    'genre:"pop"',
    'genre:"rap"',
    'genre:"r-n-b"',
    'genre:"electronic"',
  ],
  MX: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"pop"',
    'genre:"rap"',
  ],
  AR: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"trap"',
    'genre:"pop"',
  ],
  CO: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"trap"',
    'genre:"pop"',
  ],
  ES: [
    'genre:"reggaeton"',
    'genre:"latin"',
    'genre:"pop"',
    'genre:"indie"',
  ],
  PT: [
    'genre:"trap"',
    'genre:"hip hop"',
    'genre:"pop"',
    'genre:"house"',
  ],
  FR: [
    'genre:"rap"',
    'genre:"pop"',
    'genre:"electronic"',
    'genre:"house"',
  ],
  GB: [
    'genre:"hip hop"',
    'genre:"pop"',
    'genre:"house"',
    'genre:"electronic"',
  ],
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getMarketOption(country?: string) {
  return (
    MUSIC_MARKET_OPTIONS.find((option) => option.value === country) ??
    MUSIC_MARKET_OPTIONS[0]
  );
}

function getGenreOption(genre?: string) {
  return (
    MUSIC_GENRE_OPTIONS.find((option) => option.value === genre) ??
    MUSIC_GENRE_OPTIONS[0]
  );
}

function aggregateTracks(trackGroups: SpotifyTrackRecord[][]): AggregatedTrack[] {
  const trackMap = new Map<string, AggregatedTrack>();

  for (const group of trackGroups) {
    const seenInGroup = new Set<string>();

    for (const track of group) {
      const existing = trackMap.get(track.id);
      const artists = track.artists.join(", ");

      if (existing) {
        existing.popularity = Math.max(existing.popularity, track.popularity);
        existing.explicit = existing.explicit || track.explicit;
      } else {
        trackMap.set(track.id, {
          id: track.id,
          name: track.name,
          artists,
          artistIds: track.artistIds,
          albumName: track.albumName,
          popularity: track.popularity,
          playlistsCount: 0,
          durationMs: track.durationMs,
          explicit: track.explicit,
          spotifyUrl: track.spotifyUrl,
          coverUrl: track.coverUrl,
        });
      }

      if (!seenInGroup.has(track.id)) {
        seenInGroup.add(track.id);
        const aggregated = trackMap.get(track.id);

        if (aggregated) {
          aggregated.playlistsCount += 1;
        }
      }
    }
  }

  return Array.from(trackMap.values()).sort((left, right) => {
    if (right.playlistsCount !== left.playlistsCount) {
      return right.playlistsCount - left.playlistsCount;
    }

    return right.popularity - left.popularity;
  });
}

function buildTopTracks(tracks: AggregatedTrack[]): ConversionDatum[] {
  return tracks.slice(0, 8).map((track) => ({
    name: track.name,
    value: track.popularity,
  }));
}

function buildArtistDistribution(tracks: AggregatedTrack[]): ChannelDatum[] {
  const artists = new Map<string, number>();

  for (const track of tracks) {
    for (const artist of track.artists.split(", ").filter(Boolean)) {
      artists.set(artist, (artists.get(artist) ?? 0) + 1);
    }
  }

  return Array.from(artists.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([type, value]) => ({ type, value }));
}

function buildPopularityHealth(tracks: AggregatedTrack[]): ScoreBreakdown {
  if (tracks.length === 0) {
    return {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
  }

  let positive = 0;
  let neutral = 0;
  let negative = 0;

  for (const track of tracks) {
    if (track.popularity >= 70) {
      positive += 1;
    } else if (track.popularity >= 40) {
      neutral += 1;
    } else {
      negative += 1;
    }
  }

  return {
    positive: positive / tracks.length,
    neutral: neutral / tracks.length,
    negative: negative / tracks.length,
  };
}

function buildTrackInsights(tracks: AggregatedTrack[]): TrackInsight[] {
  return tracks.slice(0, 20).map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists,
    artistIds: track.artistIds,
    albumName: track.albumName,
    popularity: track.popularity,
    playlistsCount: track.playlistsCount,
    durationLabel: formatDuration(track.durationMs),
    explicit: track.explicit,
    spotifyUrl: track.spotifyUrl,
    coverUrl: track.coverUrl,
  }));
}

function buildSeedTracks(tracks: AggregatedTrack[], limit = 3) {
  return tracks.slice(0, limit).map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists,
    coverUrl: track.coverUrl,
    spotifyUrl: track.spotifyUrl,
  }));
}

function buildFeaturedPlaylistInsights(
  playlists: SpotifyFeaturedPlaylist[],
): FeaturedPlaylistInsight[] {
  return playlists.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    coverUrl: playlist.coverUrl,
    spotifyUrl: playlist.spotifyUrl,
    tracksTotal: playlist.tracksTotal,
  }));
}

function mergeGenreAndMarketTracks(
  marketTracks: AggregatedTrack[],
  genreTracks: AggregatedTrack[],
): AggregatedTrack[] {
  if (genreTracks.length === 0) {
    return marketTracks;
  }

  const marketTrackMap = new Map(
    marketTracks.map((track) => [track.id, track] as const),
  );

  return genreTracks
    .map((track) => {
      const marketTrack = marketTrackMap.get(track.id);

      return {
        ...track,
        popularity: Math.max(track.popularity, marketTrack?.popularity ?? 0),
        playlistsCount: marketTrack?.playlistsCount ?? track.playlistsCount,
        coverUrl: track.coverUrl ?? marketTrack?.coverUrl ?? null,
        albumName: track.albumName || marketTrack?.albumName || "Unknown album",
      };
    })
    .sort((left, right) => {
      if (right.playlistsCount !== left.playlistsCount) {
        return right.playlistsCount - left.playlistsCount;
      }

      return right.popularity - left.popularity;
    });
}

function buildMetrics(
  tracks: AggregatedTrack[],
  featuredPlaylists: FeaturedPlaylistInsight[],
): DashboardMetric[] {
  const averagePopularity =
    tracks.length > 0
      ? tracks.reduce((sum, track) => sum + track.popularity, 0) / tracks.length
      : 0;
  const highMomentumTracks = tracks.filter((track) => track.popularity >= 70);

  return [
    {
      title: "Tracks em Alta",
      value: formatCount(tracks.length),
      change: 0,
    },
    {
      title: "Playlists Fonte",
      value: formatCount(featuredPlaylists.length),
      change: 0,
    },
    {
      title: "Alta Tracao",
      value: formatCount(highMomentumTracks.length),
      change: 0,
    },
    {
      title: "Avg. Popularity",
      value: formatDecimal(averagePopularity),
      change: 0,
    },
  ];
}

function getMomentumScore(track: AggregatedTrack, maxPlaylistsCount: number) {
  const normalizedRecurrence =
    maxPlaylistsCount > 0 ? track.playlistsCount / maxPlaylistsCount : 0;

  return Math.round(track.popularity * 0.7 + normalizedRecurrence * 30);
}

function buildTopMovers(tracks: AggregatedTrack[]): MusicTrackHighlight[] {
  const maxPlaylistsCount = tracks.reduce(
    (maxValue, track) => Math.max(maxValue, track.playlistsCount),
    0,
  );

  return [...tracks]
    .sort((left, right) => {
      const rightScore = getMomentumScore(right, maxPlaylistsCount);
      const leftScore = getMomentumScore(left, maxPlaylistsCount);

      return rightScore - leftScore;
    })
    .slice(0, 6)
    .map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists,
      coverUrl: track.coverUrl,
      spotifyUrl: track.spotifyUrl,
      primaryMetric: `${getMomentumScore(track, maxPlaylistsCount)} pts`,
      secondaryMetric: `${track.playlistsCount} playlists · ${track.popularity} pop`,
      summary:
        track.playlistsCount > 1
          ? `Movendo o mercado com recorrencia em ${track.playlistsCount} playlists fonte.`
          : "Sinal forte de tracao com performance acima da media do radar.",
    }));
}

function buildNewEntries(tracks: AggregatedTrack[]): MusicTrackHighlight[] {
  const candidates = tracks.filter(
    (track) => track.playlistsCount <= 1 && track.popularity >= 55,
  );
  const fallbackCandidates = tracks.filter((track) => track.playlistsCount <= 2);
  const source = candidates.length >= 6 ? candidates : fallbackCandidates;

  return [...source]
    .sort((left, right) => right.popularity - left.popularity)
    .slice(0, 6)
    .map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists,
      coverUrl: track.coverUrl,
      spotifyUrl: track.spotifyUrl,
      primaryMetric: `${track.popularity} pop`,
      secondaryMetric:
        track.playlistsCount <= 1
          ? "Baixa saturacao"
          : `${track.playlistsCount} aparicoes no radar`,
      summary:
        track.playlistsCount <= 1
          ? "Faixa ainda pouco saturada e pronta para descoberta rapida."
          : "Entrada recente no radar com chance de crescer nas proximas viradas.",
    }));
}

function buildRecurringTracks(tracks: AggregatedTrack[]): TrackInsight[] {
  const recurring = tracks.filter((track) => track.playlistsCount >= 2);
  const source = recurring.length > 0 ? recurring : tracks;

  return buildTrackInsights(
    [...source]
      .sort((left, right) => {
        if (right.playlistsCount !== left.playlistsCount) {
          return right.playlistsCount - left.playlistsCount;
        }

        return right.popularity - left.popularity;
      })
      .slice(0, 12),
  );
}

function buildOpportunities(
  tracks: AggregatedTrack[],
  newEntries: MusicTrackHighlight[],
  countryLabel: string,
  genreLabel: string,
): MusicOpportunity[] {
  const recurringTracks = tracks
    .filter((track) => track.playlistsCount >= 2)
    .sort((left, right) => {
      if (right.playlistsCount !== left.playlistsCount) {
        return right.playlistsCount - left.playlistsCount;
      }

      return right.popularity - left.popularity;
    });

  const artistFrequency = new Map<
    string,
    {
      name: string;
      count: number;
    }
  >();

  for (const track of tracks) {
    for (const artist of track.artists.split(", ").filter(Boolean)) {
      const current = artistFrequency.get(artist);

      if (current) {
        current.count += 1;
      } else {
        artistFrequency.set(artist, {
          name: artist,
          count: 1,
        });
      }
    }
  }

  const topArtists = Array.from(artistFrequency.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);
  const artistDominanceTracks = tracks.filter((track) =>
    topArtists.some((artist) => track.artists.includes(artist.name)),
  );

  return [
    {
      title: "Playlist ancora de alta tracao",
      description: `Monte uma playlist ${genreLabel === "Todos os generos" ? "mainstream de mercado" : `de ${genreLabel}`} para ${countryLabel} com as faixas que ja dominaram o radar externo.`,
      rationale:
        recurringTracks.length > 0
          ? `Essas faixas ja se repetem nas playlists fonte e ajudam a entrar com aderencia imediata.`
          : "Mesmo sem grande recorrencia, esse bloco concentra as faixas mais fortes para abrir uma nova playlist.",
      badge: "High traction",
      seeds: buildSeedTracks(recurringTracks.length > 0 ? recurringTracks : tracks),
    },
    {
      title: "Janela de descoberta",
      description:
        "Use sinais ainda pouco saturados para criar uma playlist de descoberta e capturar tendencia antes da concorrencia.",
      rationale:
        newEntries.length > 0
          ? "As seeds abaixo aparecem como entradas frescas com alto potencial de crescimento."
          : "O radar ainda nao mostrou entradas frescas suficientes, entao use os movers para discovery.",
      badge: "Early signal",
      seeds: buildSeedTracks(
        tracks.filter((track) =>
          newEntries.some((entry) => entry.id === track.id),
        ),
      ),
    },
    {
      title: "Dominio de artista",
      description:
        "Crie uma frente editorial baseada nos artistas que mais estao puxando o mercado agora.",
      rationale:
        topArtists.length > 0
          ? `Os nomes mais presentes agora sao ${topArtists.map((artist) => artist.name).join(", ")}.`
          : "Ainda nao ha artistas dominantes suficientes para fechar esse cluster.",
      badge: "Artist wave",
      seeds: buildSeedTracks(
        artistDominanceTracks.length > 0 ? artistDominanceTracks : tracks,
      ),
    },
  ];
}

function buildMarketHighlight(
  countryLabel: string,
  genreLabel: string,
  featuredPlaylists: FeaturedPlaylistInsight[],
  featuredIntersectionCount: number,
) {
  if (featuredPlaylists.length === 0) {
    return "Sem leitura de mercado suficiente para este recorte agora.";
  }

  if (genreLabel === "Todos os generos") {
    return `Radar montado a partir das playlists em destaque do Spotify em ${countryLabel}.`;
  }

  if (featuredIntersectionCount > 0) {
    return `${featuredIntersectionCount} faixas do recorte ${genreLabel} tambem aparecem nas playlists em destaque de ${countryLabel}.`;
  }

  return `Leitura por ${genreLabel} em ${countryLabel}, mesmo quando o Spotify ainda nao empurrou esse som para as playlists destaque.`;
}

async function loadFeaturedPlaylistTracks(
  country: string,
  locale: string,
): Promise<{
  featuredPlaylists: FeaturedPlaylistInsight[];
  aggregatedTracks: AggregatedTrack[];
}> {
  try {
    const featuredPlaylists = await fetchFeaturedPlaylists(country, 6, locale);
    const playlistTrackGroups = await Promise.all(
      featuredPlaylists.map(async (playlist) => {
        try {
          return await fetchSpotifyPlaylistTracks(playlist.id, country);
        } catch {
          return [];
        }
      }),
    );

    return {
      featuredPlaylists: buildFeaturedPlaylistInsights(featuredPlaylists),
      aggregatedTracks: aggregateTracks(
        playlistTrackGroups.filter((group) => group.length > 0),
      ),
    };
  } catch {
    return {
      featuredPlaylists: [],
      aggregatedTracks: [],
    };
  }
}

async function loadGenreTracks(
  queries: string[],
  country: string,
): Promise<AggregatedTrack[]> {
  if (queries.length === 0) {
    return [];
  }

  try {
    const groups = await Promise.all(
      queries.map(async (query) => {
        try {
          return await fetchSpotifyTracksByGenre(query, country, 20);
        } catch {
          return [];
        }
      }),
    );

    return aggregateTracks(groups.filter((group) => group.length > 0));
  } catch {
    return [];
  }
}

export function getMusicMarketOptions(): MusicFilterOption[] {
  return MUSIC_MARKET_OPTIONS.map(({ value, label }) => ({
    value,
    label,
  }));
}

export function getMusicGenreOptions(): MusicFilterOption[] {
  return MUSIC_GENRE_OPTIONS.map(({ value, label }) => ({
    value,
    label,
  }));
}

export async function getMusicChartsData({
  country,
  genre,
}: {
  country?: string;
  genre?: string;
}): Promise<MusicChartsData> {
  const marketOption = getMarketOption(country);
  const genreOption = getGenreOption(genre);
  const marketData = await loadFeaturedPlaylistTracks(
    marketOption.value,
    marketOption.locale,
  );
  const fallbackQueries =
    genreOption.value === "all"
      ? MARKET_PROBE_QUERIES[marketOption.value] ?? MARKET_PROBE_QUERIES.BR
      : genreOption.queries;
  const searchedTracks = await loadGenreTracks(fallbackQueries, marketOption.value);
  const focusTracks =
    marketData.aggregatedTracks.length > 0
      ? mergeGenreAndMarketTracks(marketData.aggregatedTracks, searchedTracks)
      : searchedTracks;
  const topMovers = buildTopMovers(focusTracks);
  const newEntries = buildNewEntries(focusTracks);
  const recurringTracks = buildRecurringTracks(focusTracks);
  const marketTrackIds = new Set(marketData.aggregatedTracks.map((track) => track.id));
  const featuredIntersectionCount = focusTracks.filter((track) =>
    marketTrackIds.has(track.id),
  ).length;
  const explicitTracks = focusTracks.filter((track) => track.explicit);

  return {
    metrics: buildMetrics(focusTracks, marketData.featuredPlaylists),
    topTracks: buildTopTracks(focusTracks),
    artistDistribution: buildArtistDistribution(focusTracks),
    popularityHealth: buildPopularityHealth(focusTracks),
    tracks: buildTrackInsights(focusTracks),
    topMovers,
    newEntries,
    recurringTracks,
    opportunities: buildOpportunities(
      focusTracks,
      newEntries,
      marketOption.label,
      genreOption.label,
    ),
    featuredPlaylists: marketData.featuredPlaylists,
    countryValue: marketOption.value,
    countryLabel: marketOption.label,
    genreValue: genreOption.value,
    genreLabel: genreOption.label,
    topTrackName: topMovers[0]?.name ?? focusTracks[0]?.name ?? "Sem faixa lider ainda",
    explicitShare:
      focusTracks.length > 0
        ? `${Math.round((explicitTracks.length / focusTracks.length) * 100)}%`
        : "0%",
    marketHighlight: buildMarketHighlight(
      marketOption.label,
      genreOption.label,
      marketData.featuredPlaylists,
      featuredIntersectionCount,
    ),
    sourcePlaylistsCount: marketData.featuredPlaylists.length,
  };
}
