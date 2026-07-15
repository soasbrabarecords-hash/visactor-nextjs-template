-- Insert a narrow validation gate between the proven 60-day phase and the
-- existing 180-day expansion. Existing campaign dates, jobs and counters are
-- never rewritten by this catalog migration.

select pg_advisory_xact_lock(
  hashtextextended('spotify-charts-historical-v1', 0)
);

do $migration$
begin
  if exists (
    select 1
    from (
      values
        ('core-30d', 10, 30),
        ('core-60d', 20, 60),
        ('core-180d', 30, 180),
        ('core-365d', 40, 365),
        ('core-730d', 50, 730),
        ('core-1095d', 60, 1095),
        ('cities-30d', 70, 30),
        ('cities-180d', 80, 180)
    ) as expected(phase_key, phase_order, window_days)
    left join public.spotify_chart_backfill_campaigns as campaign
      on campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_key = expected.phase_key
    where campaign.id is null
      or campaign.phase_order <> expected.phase_order
      or campaign.chart_type <> 'top-songs'
      or campaign.period <> 'daily'
      or campaign.window_days <> expected.window_days
  ) then
    raise exception
      'The proven historical rollout baseline is missing or incompatible.';
  end if;

  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as campaign
    where campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_order = 25
      and campaign.phase_key <> 'core-79d'
  ) then
    raise exception
      'Rollout order 25 is already occupied by another phase.';
  end if;

  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as campaign
    where campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_key not in (
        'core-30d',
        'core-60d',
        'core-79d',
        'core-180d',
        'core-365d',
        'core-730d',
        'core-1095d',
        'cities-30d',
        'cities-180d'
      )
  ) then
    raise exception
      'The rollout contains an unknown phase; core-79d cannot be inserted safely.';
  end if;

  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as campaign
    where campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_key in (
        'core-180d',
        'core-365d',
        'core-730d',
        'core-1095d',
        'cities-30d',
        'cities-180d'
      )
      and (
        campaign.started_at is not null
        or campaign.target_start_date is not null
        or campaign.target_end_date is not null
        or campaign.status not in ('locked', 'ready')
        or exists (
          select 1
          from public.spotify_chart_backfill_campaign_jobs as campaign_job
          where campaign_job.campaign_id = campaign.id
        )
      )
  ) then
    raise exception
      'core-79d cannot be inserted after a successor phase has started.';
  end if;

  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as campaign
    where campaign.phase_key = 'core-79d'
      and (
        campaign.started_at is not null
        or campaign.target_start_date is not null
        or campaign.target_end_date is not null
        or campaign.status not in ('locked', 'ready')
        or exists (
          select 1
          from public.spotify_chart_backfill_campaign_jobs as campaign_job
          where campaign_job.campaign_id = campaign.id
        )
      )
      and (
        campaign.rollout_key <> 'spotify-charts-historical-v1'
        or campaign.phase_order <> 25
        or campaign.chart_type <> 'top-songs'
        or campaign.period <> 'daily'
        or campaign.window_days <> 79
      )
  ) then
    raise exception
      'An active core-79d phase has incompatible persisted metadata.';
  end if;
end
$migration$;

insert into public.spotify_chart_backfill_campaigns (
  rollout_key,
  phase_key,
  phase_order,
  name,
  chart_type,
  period,
  window_days,
  status
)
values (
  'spotify-charts-historical-v1',
  'core-79d',
  25,
  'BR + Global — 79 dias',
  'top-songs',
  'daily',
  79,
  'locked'
)
on conflict (phase_key) do update
set
  rollout_key = excluded.rollout_key,
  phase_order = excluded.phase_order,
  name = excluded.name,
  chart_type = excluded.chart_type,
  period = excluded.period,
  window_days = excluded.window_days;

insert into public.spotify_chart_backfill_campaign_regions (
  campaign_id,
  region_id
)
select campaign.id, region.region_id
from public.spotify_chart_backfill_campaigns as campaign
cross join (
  values ('BR'), ('GLOBAL')
) as region(region_id)
where campaign.rollout_key = 'spotify-charts-historical-v1'
  and campaign.phase_key = 'core-79d'
on conflict (campaign_id, region_id) do nothing;

do $migration$
begin
  if (
    select count(*)
    from public.spotify_chart_backfill_campaign_regions as campaign_region
    join public.spotify_chart_backfill_campaigns as campaign
      on campaign.id = campaign_region.campaign_id
    where campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_key = 'core-79d'
  ) <> 2
  or exists (
    select 1
    from public.spotify_chart_backfill_campaign_regions as campaign_region
    join public.spotify_chart_backfill_campaigns as campaign
      on campaign.id = campaign_region.campaign_id
    where campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_key = 'core-79d'
      and campaign_region.region_id not in ('BR', 'GLOBAL')
  ) then
    raise exception 'core-79d must contain exactly BR and Global.';
  end if;
end
$migration$;

-- Rebuild the ready gate without touching any phase that has already started.
-- If core-60d was approved, core-79d becomes ready; otherwise every successor
-- remains locked until the existing approval RPC advances the immediate gate.
update public.spotify_chart_backfill_campaigns as campaign
set status = 'locked'
where campaign.rollout_key = 'spotify-charts-historical-v1'
  and campaign.phase_order > 20
  and campaign.started_at is null
  and campaign.status = 'ready';

with next_eligible as (
  select candidate.id
  from public.spotify_chart_backfill_campaigns as candidate
  where candidate.rollout_key = 'spotify-charts-historical-v1'
    and candidate.status = 'locked'
    and candidate.started_at is null
    and not exists (
      select 1
      from public.spotify_chart_backfill_campaigns as predecessor
      where predecessor.rollout_key = candidate.rollout_key
        and predecessor.phase_order < candidate.phase_order
        and (
          predecessor.status <> 'completed'
          or predecessor.approved_at is null
        )
    )
  order by candidate.phase_order
  limit 1
)
update public.spotify_chart_backfill_campaigns as campaign
set status = 'ready'
from next_eligible
where campaign.id = next_eligible.id;

-- A complete Top 200 snapshot can predate a campaign or survive a prior retry.
-- Reconcile those pending rows without claiming them, while keeping the normal
-- job transition/audit triggers and campaign completion gate in force.
create or replace function public.reconcile_spotify_chart_backfill_covered_jobs(
  p_phase_key text,
  p_limit integer default 100
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_campaign public.spotify_chart_backfill_campaigns;
  reconciled_count integer := 0;
begin
  if p_phase_key is null
    or p_phase_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'Invalid phase_key.';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'limit must be between 1 and 500.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('spotify-charts-historical-v1', 0)
  );

  select campaign.*
  into target_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.phase_key = p_phase_key
  for update;

  if target_campaign.id is null
    or target_campaign.rollout_key <> 'spotify-charts-historical-v1'
  then
    raise exception 'Unknown historical Spotify chart phase: %', p_phase_key;
  end if;

  if target_campaign.status <> 'running' then
    raise exception 'Only a running campaign can reconcile covered jobs.';
  end if;

  if target_campaign.target_start_date is null
    or target_campaign.target_end_date is null
    or target_campaign.expected_job_count <= 0
  then
    raise exception 'The running campaign has not been seeded correctly.';
  end if;

  with candidate as materialized (
    select job.id
    from public.spotify_chart_backfill_campaign_jobs as campaign_job
    join public.spotify_chart_backfill_jobs as job
      on job.id = campaign_job.job_id
    join public.spotify_chart_regions as region
      on region.region_key = job.region_id
    where campaign_job.campaign_id = target_campaign.id
      and job.status = 'pending'
      and job.chart_type = target_campaign.chart_type
      and job.period = target_campaign.period
      and job.target_date between
        target_campaign.target_start_date and target_campaign.target_end_date
      and exists (
        select 1
        from public.spotify_chart_backfill_campaign_regions as campaign_region
        where campaign_region.campaign_id = target_campaign.id
          and campaign_region.region_id = job.region_id
      )
      and exists (
        select 1
        from public.spotify_chart_complete_snapshots as complete
        where complete.country = job.region_id
          and complete.chart_type = job.chart_type
          and complete.chart_date = job.target_date
      )
    order by
      job.target_date desc,
      region.priority asc,
      job.created_at asc,
      job.id asc
    for update of job skip locked
    limit p_limit
  ), reconciled as (
    update public.spotify_chart_backfill_jobs as job
    set
      status = 'skipped',
      last_error =
        'Snapshot Top 200 already complete; reconciled without a worker claim.'
    from candidate
    where job.id = candidate.id
      and job.status = 'pending'
    returning job.id
  )
  select count(*)::integer
  into reconciled_count
  from reconciled;

  perform *
  from public.refresh_spotify_chart_backfill_campaign_progress(p_phase_key);

  return reconciled_count;
end
$function$;

comment on function public.reconcile_spotify_chart_backfill_covered_jobs(
  text,
  integer
) is
  'Marks pending campaign jobs skipped only when a strict complete Top 200 snapshot already exists.';

revoke all on function public.reconcile_spotify_chart_backfill_covered_jobs(
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.reconcile_spotify_chart_backfill_covered_jobs(
  text,
  integer
) to service_role;
