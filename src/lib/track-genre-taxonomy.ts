import type {
  TrackGenreEvidence,
  TrackGenreProfile,
  TrackGenreSource,
  TrackGenreSourceId,
  TrackProfileGenre,
  TrackProfileInput,
} from "@/types/track-profile";

export type GenreClassificationInput = TrackProfileInput & {
  evidence?: TrackGenreEvidence[];
  sources?: TrackGenreSource[];
};

const SOURCE_LABELS: Record<TrackGenreSourceId, string> = {
  manual_override: "Correção manual",
  spotify_metadata: "Spotify metadata",
  spotify_artist_genres: "Spotify artist genres",
  musicbrainz: "MusicBrainz",
  lastfm_track: "Last.fm track tags",
  lastfm_artist: "Last.fm artist tags",
  deezer_catalog: "Deezer track catalog",
  apple_catalog: "Apple track catalog",
  workspace_context: "Contexto do workspace",
  internal_taxonomy: "Taxonomia interna",
};

const GENRE_RULES: Array<{
  genre: TrackProfileGenre;
  terms: string[];
}> = [
  {
    genre: "funk",
    terms: [
      "funk brasileiro",
      "funk carioca",
      "baile funk",
      "mandelao",
      "mandelao",
      "brega funk",
      "funk ostentacao",
      "funk consciente",
      "funk melody",
      "mc hariel",
      "mc cabelinho",
      "mc ig",
      "mc tuto",
    ],
  },
  {
    genre: "trap",
    terms: [
      "brazilian trap",
      "trap brasileiro",
      "trap latino",
      "trap",
      "drill",
      "plugg",
      "rage rap",
      "veigh",
      "matue",
      "teto",
      "orochi",
    ],
  },
  {
    genre: "rap",
    terms: [
      "brazilian hip hop",
      "hip hop brasileiro",
      "hip-hop",
      "hip hop",
      "boom bap",
      "rap nacional",
      "rap",
      "grime",
    ],
  },
  {
    genre: "sertanejo",
    terms: [
      "sertanejo universitario",
      "sertanejo pop",
      "sertanejo",
      "modao",
      "agronejo",
      "arrocha",
    ],
  },
  {
    genre: "piseiro_forro",
    terms: [
      "forro eletronico",
      "forro tradicional",
      "piseiro",
      "pisadinha",
      "forro",
      "vaquejada",
      "xote",
    ],
  },
  {
    genre: "dance_eletronico",
    terms: [
      "electronic dance music",
      "dance pop",
      "electronica",
      "eletronico",
      "electronic",
      "house",
      "techno",
      "edm",
      "trance",
      "drum and bass",
      "phonk",
    ],
  },
  {
    genre: "afro_latin",
    terms: [
      "afrobeats",
      "afrobeat",
      "amapiano",
      "reggaeton",
      "latin pop",
      "musica latina",
      "latin trap",
      "dancehall",
      "dembow",
      "salsa",
      "bachata",
    ],
  },
  {
    genre: "rock",
    terms: [
      "alternative rock",
      "indie rock",
      "pop rock",
      "hard rock",
      "punk rock",
      "metal",
      "rock",
      "grunge",
      "emo",
    ],
  },
  {
    genre: "pop_global",
    terms: [
      "global pop",
      "k-pop",
      "kpop",
      "j-pop",
      "international pop",
      "uk pop",
      "dance pop",
      "synthpop",
    ],
  },
  {
    genre: "pop",
    terms: ["brazilian pop", "pop brasileiro", "mpb pop", "teen pop", "pop"],
  },
];

const SUBGENRE_TERMS = [
  "funk carioca",
  "baile funk",
  "brega funk",
  "funk melody",
  "trap brasileiro",
  "drill",
  "plugg",
  "boom bap",
  "rap nacional",
  "sertanejo universitario",
  "agronejo",
  "arrocha",
  "piseiro",
  "pisadinha",
  "forro eletronico",
  "dance pop",
  "house",
  "techno",
  "phonk",
  "afrobeats",
  "amapiano",
  "reggaeton",
  "latin trap",
  "indie rock",
  "alternative rock",
  "k-pop",
] as const;

const MOOD_RULES: Record<string, string[]> = {
  romantica: ["romantic", "romantico", "love", "amor"],
  melancolica: ["sad", "melancholy", "melancolico", "heartbreak"],
  festa: ["party", "festa", "club", "carnaval"],
  motivacional: ["motivational", "uplifting", "motivacao"],
  intensa: ["aggressive", "intense", "hard", "pesado"],
  relax: ["chill", "relax", "calm", "acoustic", "acustico"],
};

const ENERGY_RULES: Record<string, string[]> = {
  alta: ["high energy", "energetic", "party", "club", "aggressive", "dance"],
  media: ["groove", "midtempo", "pop", "melodic"],
  baixa: ["low energy", "chill", "calm", "acoustic", "ambient", "ballad"],
};

const DEFAULT_WEIGHTS: Record<TrackGenreSourceId, number> = {
  manual_override: 1000,
  musicbrainz: 34,
  lastfm_track: 32,
  deezer_catalog: 30,
  apple_catalog: 28,
  spotify_artist_genres: 26,
  lastfm_artist: 24,
  workspace_context: 20,
  spotify_metadata: 14,
  internal_taxonomy: 12,
};

export function normalizeGenreText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function containsNormalizedTerm(value: string, term: string) {
  const normalizedValue = normalizeGenreText(value);
  const normalizedTerm = normalizeGenreText(term);
  if (!normalizedValue || !normalizedTerm) return false;
  return ` ${normalizedValue} `.includes(` ${normalizedTerm} `);
}

export function genresFromTerms(values: string[]) {
  const normalizedValues = values.map(normalizeGenreText).filter(Boolean);
  return unique(
    GENRE_RULES.flatMap(({ genre, terms }) =>
      terms.some((term) =>
        normalizedValues.some((value) => containsNormalizedTerm(value, term)),
      )
        ? [genre]
        : [],
    ),
  );
}

export function createGenreEvidence({
  source,
  tags,
  detail,
  weight,
  external = false,
}: {
  source: TrackGenreSourceId;
  tags: string[];
  detail: string;
  weight?: number;
  external?: boolean;
}): TrackGenreEvidence | null {
  const cleanTags = unique(tags.map((tag) => tag.trim()).filter(Boolean)).slice(
    0,
    30,
  );
  const genres = genresFromTerms(cleanTags);
  if (genres.length === 0) return null;
  return {
    source,
    genres,
    tags: cleanTags,
    detail,
    weight: weight ?? DEFAULT_WEIGHTS[source],
    external,
  };
}

function inferInternalEvidence(input: TrackProfileInput) {
  const metadata = [
    input.name ?? "",
    input.artists ?? "",
    input.albumName ?? "",
  ];
  const context = (input.playlistContext ?? []).flatMap((playlist) => [
    playlist.name,
    playlist.description ?? "",
  ]);
  return [
    createGenreEvidence({
      source: "spotify_metadata",
      tags: metadata,
      detail:
        "Nome da faixa, artista e álbum usados somente como sinal textual.",
    }),
    createGenreEvidence({
      source: "workspace_context",
      tags: context,
      detail: "Nome e descrição das playlists do workspace que contêm a faixa.",
    }),
    createGenreEvidence({
      source: "internal_taxonomy",
      tags: [...metadata, ...context],
      detail: "Correspondência explicável com a taxonomia interna V1.",
    }),
  ].filter((evidence): evidence is TrackGenreEvidence => Boolean(evidence));
}

function tagsFromEvidence(evidence: TrackGenreEvidence[]) {
  return unique(evidence.flatMap((item) => item.tags).map(normalizeGenreText));
}

function matchLabels(tags: string[], rules: Record<string, string[]>) {
  return Object.entries(rules).flatMap(([label, terms]) =>
    terms.some((term) => tags.some((tag) => containsNormalizedTerm(tag, term)))
      ? [label]
      : [],
  );
}

function inferLanguage(input: TrackProfileInput, tags: string[]) {
  const haystack = normalizeGenreText(
    [input.name, input.artists, input.albumName, ...tags]
      .filter(Boolean)
      .join(" "),
  );
  if (
    /\b(brasileiro|brasileira|sertanejo|forro|piseiro|pagode|portugues)\b/.test(
      haystack,
    )
  )
    return "pt-BR";
  if (/\b(latino|latina|reggaeton|espanol|mexicano|argentino)\b/.test(haystack))
    return "es";
  if (/\b(english|uk pop|american|global pop)\b/.test(haystack)) return "en";
  return "desconhecido";
}

function inferCountry(input: TrackProfileInput) {
  if (input.chartCountry === "BR") return "BR";
  const isrcCountry = input.isrc?.trim().slice(0, 2).toUpperCase();
  // The first two ISRC characters identify the registrant territory, not a
  // definitive artist/recording origin, so keep that distinction explicit.
  if (isrcCountry?.match(/^[A-Z]{2}$/)) return `ISRC-${isrcCountry}`;
  return "desconhecido";
}

export function confidenceLabel(value: number) {
  if (value >= 80) return "alta" as const;
  if (value >= 60) return "media" as const;
  return "baixa" as const;
}

export function classifyTrackGenre(
  input: GenreClassificationInput,
): TrackGenreProfile {
  const supplied = input.evidence ?? [];
  const artistEvidence = createGenreEvidence({
    source: "spotify_artist_genres",
    tags: input.artistGenres ?? [],
    detail: "Gêneros informados no perfil dos artistas no Spotify.",
    external: true,
  });
  const evidence = [
    ...supplied,
    ...(artistEvidence ? [artistEvidence] : []),
    ...inferInternalEvidence(input),
  ];
  const scores = new Map<TrackProfileGenre, number>();
  const sourceAgreement = new Map<TrackProfileGenre, Set<TrackGenreSourceId>>();

  for (const item of evidence) {
    for (const genre of item.genres) {
      scores.set(genre, (scores.get(genre) ?? 0) + item.weight);
      const sources = sourceAgreement.get(genre) ?? new Set();
      sources.add(item.source);
      sourceAgreement.set(genre, sources);
    }
  }

  const ranked = [...scores.entries()].sort(
    (left, right) => right[1] - left[1],
  );
  const primaryGenre = ranked[0]?.[0] ?? "desconhecido";
  const primarySources = sourceAgreement.get(primaryGenre) ?? new Set();
  const primaryEvidence = evidence.filter((item) =>
    item.genres.includes(primaryGenre),
  );
  const manual = primarySources.has("manual_override");
  const reliableAgreement = new Set(
    primaryEvidence
      .filter(
        (item) =>
          item.source !== "internal_taxonomy" &&
          item.source !== "spotify_metadata" &&
          item.source !== "workspace_context",
      )
      .map((item) => item.source),
  ).size;
  const hasExternal = primaryEvidence.some((item) => item.external);
  const hasTrackLevelExternal = primaryEvidence.some(
    (item) => item.source === "musicbrainz" || item.source === "lastfm_track",
  );
  const hasContext = primarySources.has("workspace_context");
  let genreConfidence = 15;
  if (manual) genreConfidence = 100;
  else if (hasTrackLevelExternal && reliableAgreement >= 2)
    genreConfidence = 88;
  else if (hasTrackLevelExternal && hasContext) genreConfidence = 76;
  else if (hasTrackLevelExternal && primarySources.size >= 2)
    genreConfidence = 68;
  else if (hasTrackLevelExternal) genreConfidence = 60;
  else if (hasExternal && reliableAgreement >= 2) genreConfidence = 56;
  else if (hasExternal) genreConfidence = 48;
  else if (hasContext && primarySources.size >= 2) genreConfidence = 52;
  else if (primaryGenre !== "desconhecido") genreConfidence = 38;

  const allTags = tagsFromEvidence(evidence);
  const secondaryGenres = ranked
    .slice(1)
    .filter(([, score]) => score >= Math.max(12, (ranked[0]?.[1] ?? 0) * 0.35))
    .map(([genre]) => genre)
    .filter((genre) => genre !== "desconhecido")
    .slice(0, 3);
  const subgenres = SUBGENRE_TERMS.filter((term) =>
    allTags.some((tag) => containsNormalizedTerm(tag, term)),
  ).slice(0, 6);
  const sourceIds = new Set(evidence.map((item) => item.source));
  const suppliedSources = input.sources ?? [];
  const genreSources: TrackGenreSource[] = unique([
    ...suppliedSources.map((source) => source.id),
    ...sourceIds,
  ]).map(
    (id) =>
      suppliedSources.find((source) => source.id === id) ?? {
        id,
        label: SOURCE_LABELS[id],
        status: sourceIds.has(id) ? "used" : "empty",
      },
  );

  return {
    spotifyTrackId: input.spotifyTrackId,
    spotifyArtistIds: input.artistIds ?? [],
    trackName: input.name?.trim() || "Faixa não informada",
    artistName: input.artists?.trim() || "Artista não informado",
    albumName: input.albumName?.trim() || null,
    isrc: input.isrc?.trim().toUpperCase() || null,
    primaryGenre,
    secondaryGenres,
    subgenres,
    moodTags: matchLabels(allTags, MOOD_RULES).slice(0, 4),
    energyTags: matchLabels(allTags, ENERGY_RULES).slice(0, 3),
    languageSignal: inferLanguage(input, allTags),
    countrySignal: inferCountry(input),
    genreConfidence,
    confidenceLabel: confidenceLabel(genreConfidence),
    genreSources,
    genreEvidence: evidence.slice(0, 20),
    lastEnrichedAt: new Date().toISOString(),
    manualOverride: manual,
    manualOverrideEntityType: manual ? "track" : null,
  };
}
