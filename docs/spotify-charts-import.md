# Spotify Charts Import

Esta fase apenas prepara a base para futuros rankings por streams diários reais.

## Arquivos adicionados

- `supabase/schema.sql`
- `src/lib/spotify-charts-store.ts`
- `src/lib/spotify-charts-importer.ts`

## Tabelas

### `spotify_chart_entries`

Guarda a leitura principal do chart por dia, país e faixa.

Campos principais:

- `spotify_track_id`
- `track_name`
- `artist_name`
- `artist_ids`
- `album_name`
- `image_url`
- `spotify_url`
- `country`
- `genre`
- `chart_name`
- `source_type`
- `chart_date`
- `rank_position`
- `previous_rank`
- `movement_type`
- `daily_streams`
- `captured_at`

### `track_stream_snapshots`

Guarda snapshots diários de streams por faixa para comparação futura.

Campos principais:

- `spotify_track_id`
- `track_name`
- `artist_name`
- `artist_ids`
- `album_name`
- `image_url`
- `spotify_url`
- `country`
- `genre`
- `chart_name`
- `chart_date`
- `daily_streams`
- `rank_position`
- `previous_rank`
- `captured_at`

## Store

`src/lib/spotify-charts-store.ts` expõe:

- `fetchSpotifyChartEntries`
- `upsertSpotifyChartEntries`
- `fetchLatestSpotifyChartEntries`
- `fetchTrackStreamSnapshots`

Todos seguem o padrão atual do projeto:

- `server-only`
- REST API do Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Importer

`src/lib/spotify-charts-importer.ts` expõe:

- `importSpotifyChartRows(rows)`

O fluxo faz:

1. validação de linhas obrigatórias
2. normalização de tipos
3. remoção de duplicados
4. upsert em `spotify_chart_entries`
5. alimentação de `track_stream_snapshots`

Retorno:

- `insertedCount`
- `skippedCount`
- `errors`

## Exemplo de uso

```ts
import { importSpotifyChartRows } from "@/lib/spotify-charts-importer";

const result = await importSpotifyChartRows([
  {
    spotify_track_id: "123",
    track_name: "Minha Faixa",
    artist_name: "Minha Artista",
    artist_ids: ["artist-1"],
    album_name: "Meu Album",
    image_url: "https://...",
    spotify_url: "https://open.spotify.com/track/123",
    country: "BR",
    genre: "trap",
    chart_name: "top-songs",
    source_type: "spotify_chart",
    chart_date: "2026-04-26",
    rank_position: 4,
    previous_rank: 8,
    movement_type: "up",
    daily_streams: 182345,
    captured_at: new Date().toISOString(),
  },
]);
```

## Observações

- Esta fase não altera a UI.
- Esta fase não altera `music-charts-data.ts`.
- Esta fase não adiciona scraping.
- O próximo passo pode conectar esse importer ao fluxo real de ingestão quando você decidir ativar streams no ranking.
