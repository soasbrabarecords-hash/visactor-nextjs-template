-- The first chart_snapshots schema used top_200_daily and some production
-- databases also retained a UNIQUE (chart_date, country) constraint. The
-- historical worker writes top-songs and targets the newer three-column key,
-- so a complete legacy BR snapshot could collide before ON CONFLICT ran.

set local lock_timeout = '5s';

lock table public.chart_snapshots in share row exclusive mode;

do $migration$
begin
  if exists (
    select 1
    from public.chart_snapshots as legacy
    join public.chart_snapshots as canonical
      on canonical.country = legacy.country
     and canonical.chart_date = legacy.chart_date
     and canonical.chart_type = 'top-songs'
     and canonical.id <> legacy.id
    where legacy.chart_type = 'top_200_daily'
  ) then
    raise exception
      'Cannot normalize chart snapshot identity while legacy and canonical rows overlap.';
  end if;
end
$migration$;

update public.chart_snapshots
set chart_type = 'top-songs'
where chart_type = 'top_200_daily';

alter table public.chart_snapshots
  alter column chart_type set default 'top-songs';

alter table public.chart_snapshots
  drop constraint if exists chart_snapshots_chart_date_country_key;

drop index if exists public.chart_snapshots_chart_date_country_key;

create unique index if not exists chart_snapshots_country_type_date_key
  on public.chart_snapshots (country, chart_type, chart_date);
