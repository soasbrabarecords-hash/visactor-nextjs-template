create table if not exists public.track_genre_profiles (
  spotify_track_id text primary key,
  spotify_artist_ids text[] not null default '{}',
  track_name text not null default '',
  artist_name text not null default '',
  album_name text,
  isrc text,
  primary_genre text not null default 'desconhecido' check (
    primary_genre in (
      'funk',
      'trap',
      'rap',
      'sertanejo',
      'piseiro_forro',
      'pop',
      'pop_global',
      'rock',
      'dance_eletronico',
      'afro_latin',
      'desconhecido'
    )
  ),
  secondary_genres text[] not null default '{}',
  subgenres text[] not null default '{}',
  mood_tags text[] not null default '{}',
  energy_tags text[] not null default '{}',
  language_signal text not null default 'desconhecido',
  country_signal text not null default 'desconhecido',
  genre_confidence integer not null default 0 check (
    genre_confidence between 0 and 100
  ),
  genre_sources jsonb not null default '[]'::jsonb check (
    jsonb_typeof(genre_sources) = 'array'
  ),
  genre_evidence jsonb not null default '[]'::jsonb check (
    jsonb_typeof(genre_evidence) = 'array'
  ),
  enrichment_version text not null default 'v1',
  last_enriched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists track_genre_profiles_isrc_idx
  on public.track_genre_profiles (isrc)
  where isrc is not null;

create index if not exists track_genre_profiles_primary_genre_idx
  on public.track_genre_profiles (primary_genre, genre_confidence desc);

create index if not exists track_genre_profiles_last_enriched_idx
  on public.track_genre_profiles (last_enriched_at desc);

create table if not exists public.music_genre_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('track', 'artist')),
  entity_id text not null,
  primary_genre text not null check (
    primary_genre in (
      'funk',
      'trap',
      'rap',
      'sertanejo',
      'piseiro_forro',
      'pop',
      'pop_global',
      'rock',
      'dance_eletronico',
      'afro_latin',
      'desconhecido'
    )
  ),
  secondary_genres text[] not null default '{}',
  subgenres text[] not null default '{}',
  mood_tags text[] not null default '{}',
  energy_tags text[] not null default '{}',
  language_signal text,
  country_signal text,
  note text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, entity_type, entity_id)
);

create index if not exists music_genre_overrides_workspace_entity_idx
  on public.music_genre_overrides (workspace_id, entity_id, entity_type);

create index if not exists music_genre_overrides_updated_by_idx
  on public.music_genre_overrides (updated_by)
  where updated_by is not null;

alter table public.track_genre_profiles enable row level security;
alter table public.music_genre_overrides enable row level security;

revoke all on public.track_genre_profiles from anon, authenticated;
revoke all on public.music_genre_overrides from anon, authenticated;
grant all on public.track_genre_profiles to service_role;
grant all on public.music_genre_overrides to service_role;

comment on table public.track_genre_profiles is
  'Operational genre profiles built from metadata and taxonomy evidence. Spotify content is not used for ML training.';

comment on table public.music_genre_overrides is
  'Workspace-scoped manual genre corrections. A track override has precedence over an artist override.';
