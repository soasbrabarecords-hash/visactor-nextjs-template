-- Configurable region registry for Spotify Charts (global configuration).
--
-- The existing chart tables intentionally keep using their legacy `country`
-- text column. `region_key` is the canonical value stored in that column, so
-- BR and GLOBAL remain fully backward compatible and no historical row needs
-- to be rewritten by this migration.

create table if not exists public.spotify_chart_regions (
  region_key text primary key,
  display_name text not null,
  type text not null,
  country_code text,
  city_name text,
  parent_region_key text,
  source_key text not null unique,
  enabled boolean not null default false,
  backfill_enabled boolean not null default false,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint spotify_chart_regions_type_check
    check (type in ('global', 'country', 'city')),
  constraint spotify_chart_regions_region_key_check
    check (
      region_key = upper(region_key)
      and region_key ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'
    ),
  constraint spotify_chart_regions_display_name_check
    check (nullif(btrim(display_name), '') is not null),
  constraint spotify_chart_regions_source_key_check
    check (
      source_key = lower(source_key)
      and source_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint spotify_chart_regions_priority_check
    check (priority >= 0),
  constraint spotify_chart_regions_not_own_parent_check
    check (parent_region_key is null or parent_region_key <> region_key),
  constraint spotify_chart_regions_shape_check
    check (
      (
        type = 'global'
        and country_code is null
        and city_name is null
        and parent_region_key is null
      )
      or
      (
        type = 'country'
        and country_code is not null
        and country_code ~ '^[A-Z]{2}$'
        and city_name is null
        and parent_region_key is null
      )
      or
      (
        type = 'city'
        and country_code is not null
        and country_code ~ '^[A-Z]{2}$'
        and nullif(btrim(city_name), '') is not null
        and parent_region_key is not null
      )
    ),
  constraint spotify_chart_regions_parent_fkey
    foreign key (parent_region_key)
    references public.spotify_chart_regions(region_key)
    on update cascade
    on delete restrict
);

comment on table public.spotify_chart_regions is
  'Global Spotify Charts region registry. region_key is persisted in legacy country columns.';
comment on column public.spotify_chart_regions.region_key is
  'Canonical internal key, for example BR, GLOBAL or BR-SP-SAO-PAULO.';
comment on column public.spotify_chart_regions.country_code is
  'ISO 3166-1 alpha-2 market used for Spotify metadata enrichment; null for Global.';
comment on column public.spotify_chart_regions.source_key is
  'Stable provider/source identifier. It is intentionally distinct from region_key.';
comment on column public.spotify_chart_regions.enabled is
  'Region is available for future ingestion and filtering. This migration does not change the cron source list.';
comment on column public.spotify_chart_regions.backfill_enabled is
  'Region may be used by a future configurable backfill flow.';

create index if not exists spotify_chart_regions_enabled_priority_idx
  on public.spotify_chart_regions (priority, region_key)
  where enabled;

create index if not exists spotify_chart_regions_backfill_priority_idx
  on public.spotify_chart_regions (priority, region_key)
  where backfill_enabled;

create index if not exists spotify_chart_regions_parent_idx
  on public.spotify_chart_regions (parent_region_key)
  where parent_region_key is not null;

create schema if not exists private;

create or replace function private.spotify_chart_regions_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

revoke all on function private.spotify_chart_regions_touch_updated_at()
  from public, anon, authenticated;

drop trigger if exists spotify_chart_regions_touch_updated_at
  on public.spotify_chart_regions;
create trigger spotify_chart_regions_touch_updated_at
  before update on public.spotify_chart_regions
  for each row
  execute function private.spotify_chart_regions_touch_updated_at();

alter table public.spotify_chart_regions enable row level security;

revoke all on table public.spotify_chart_regions from anon, authenticated;
grant select on table public.spotify_chart_regions to authenticated;
grant select, insert, update, delete on table public.spotify_chart_regions
  to service_role;

drop policy if exists "authenticated can read spotify chart regions"
  on public.spotify_chart_regions;
create policy "authenticated can read spotify chart regions"
  on public.spotify_chart_regions
  for select
  to authenticated
  using (true);

-- Preserve the exact active order and behavior used by the current cron.
insert into public.spotify_chart_regions (
  region_key,
  display_name,
  type,
  country_code,
  city_name,
  parent_region_key,
  source_key,
  enabled,
  backfill_enabled,
  priority
)
values
  ('BR', 'Brasil', 'country', 'BR', null, null, 'br', true, true, 10),
  ('GLOBAL', 'Global', 'global', null, null, null, 'global', true, true, 20)
on conflict (region_key) do nothing;

-- City rows are intentionally disabled until each regional source is validated.
-- Enabling them here would change automation behavior before the importer is ready.
insert into public.spotify_chart_regions (
  region_key,
  display_name,
  type,
  country_code,
  city_name,
  parent_region_key,
  source_key,
  enabled,
  backfill_enabled,
  priority
)
values
  (
    'BR-SP-SAO-PAULO',
    'São Paulo',
    'city',
    'BR',
    'São Paulo',
    'BR',
    'br-sao-paulo',
    false,
    false,
    30
  ),
  (
    'BR-RJ-RIO-DE-JANEIRO',
    'Rio de Janeiro',
    'city',
    'BR',
    'Rio de Janeiro',
    'BR',
    'br-rio-de-janeiro',
    false,
    false,
    40
  ),
  (
    'BR-RS-PORTO-ALEGRE',
    'Porto Alegre',
    'city',
    'BR',
    'Porto Alegre',
    'BR',
    'br-porto-alegre',
    false,
    false,
    50
  )
on conflict (region_key) do nothing;
