-- Extend the proven BR + Global rollout without changing its calendar anchor.
-- Every phase reuses the idempotent jobs from the previous phase and only adds
-- the older dates that are still missing.

-- Serialize the catalog upgrade with campaign starts for this rollout.
select pg_advisory_xact_lock(
  hashtextextended('spotify-charts-historical-v1', 0)
);

do $migration$
begin
  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as campaign
    where campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_key <> 'core-30d'
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
      'Long-range rollout cannot be installed after a later phase has started.';
  end if;
end
$migration$;

alter table public.spotify_chart_backfill_campaigns
  drop constraint if exists spotify_chart_backfill_campaigns_window_days_check;

alter table public.spotify_chart_backfill_campaigns
  add constraint spotify_chart_backfill_campaigns_window_days_check
  check (window_days between 1 and 1095);

alter table public.spotify_chart_backfill_campaigns
  drop constraint if exists spotify_chart_backfill_campaigns_exact_window_check;

alter table public.spotify_chart_backfill_campaigns
  add constraint spotify_chart_backfill_campaigns_exact_window_check
  check (
    (
      target_start_date is null
      and target_end_date is null
    )
    or (
      target_start_date is not null
      and target_end_date is not null
      and target_start_date = target_end_date - (window_days - 1)
    )
  );

-- Move the original orders out of the way before assigning the expanded order.
update public.spotify_chart_backfill_campaigns as campaign
set phase_order = campaign.phase_order + 100
where campaign.rollout_key = 'spotify-charts-historical-v1'
  and campaign.phase_key in (
    'core-30d',
    'core-180d',
    'core-365d',
    'cities-30d',
    'cities-180d'
  );

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
values
  (
    'spotify-charts-historical-v1',
    'core-30d',
    10,
    'BR + Global — 30 dias',
    'top-songs',
    'daily',
    30,
    'ready'
  ),
  (
    'spotify-charts-historical-v1',
    'core-60d',
    20,
    'BR + Global — 60 dias',
    'top-songs',
    'daily',
    60,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'core-180d',
    30,
    'BR + Global — 6 meses',
    'top-songs',
    'daily',
    180,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'core-365d',
    40,
    'BR + Global — 1 ano',
    'top-songs',
    'daily',
    365,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'core-730d',
    50,
    'BR + Global — 2 anos',
    'top-songs',
    'daily',
    730,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'core-1095d',
    60,
    'BR + Global — 3 anos',
    'top-songs',
    'daily',
    1095,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'cities-30d',
    70,
    'SP + RJ + Porto Alegre — 30 dias',
    'top-songs',
    'daily',
    30,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'cities-180d',
    80,
    'SP + RJ + Porto Alegre — 6 meses',
    'top-songs',
    'daily',
    180,
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
join (
  values
    ('core-30d', 'BR'),
    ('core-30d', 'GLOBAL'),
    ('core-60d', 'BR'),
    ('core-60d', 'GLOBAL'),
    ('core-180d', 'BR'),
    ('core-180d', 'GLOBAL'),
    ('core-365d', 'BR'),
    ('core-365d', 'GLOBAL'),
    ('core-730d', 'BR'),
    ('core-730d', 'GLOBAL'),
    ('core-1095d', 'BR'),
    ('core-1095d', 'GLOBAL')
) as region(phase_key, region_id)
  on region.phase_key = campaign.phase_key
where campaign.rollout_key = 'spotify-charts-historical-v1'
on conflict (campaign_id, region_id) do nothing;

do $migration$
begin
  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as campaign
    left join public.spotify_chart_backfill_campaign_regions as campaign_region
      on campaign_region.campaign_id = campaign.id
    where campaign.rollout_key = 'spotify-charts-historical-v1'
      and campaign.phase_key in (
        'core-30d',
        'core-60d',
        'core-180d',
        'core-365d',
        'core-730d',
        'core-1095d'
      )
    group by campaign.id
    having count(*) <> 2
  ) then
    raise exception 'Every core phase must contain exactly BR and Global.';
  end if;
end
$migration$;

-- Campaign coverage follows the same exact Top 200 contract enforced by the
-- worker and by replace_spotify_chart_snapshot_v1.
create or replace view public.spotify_chart_complete_snapshots
with (security_invoker = true)
as
select
  integrity.snapshot_id,
  integrity.country,
  integrity.chart_type,
  integrity.chart_date,
  integrity.total_tracks,
  integrity.tracks_count,
  integrity.imported_at
from (
  select
    snapshot.id as snapshot_id,
    snapshot.country,
    snapshot.chart_type,
    snapshot.chart_date,
    snapshot.total_tracks,
    count(*)::integer as tracks_count,
    count(distinct track.position)::integer as unique_positions,
    count(
      distinct nullif(btrim(track.spotify_track_id), '')
    )::integer as unique_track_ids,
    min(track.position)::integer as min_position,
    max(track.position)::integer as max_position,
    count(*) filter (
      where track.position is null
        or track.position < 1
        or track.position > 200
        or nullif(btrim(track.spotify_track_id), '') is null
        or nullif(btrim(track.track_name), '') is null
        or track.chart_date is distinct from snapshot.chart_date
    )::integer as invalid_rows,
    snapshot.imported_at
  from public.chart_snapshots as snapshot
  join public.chart_snapshot_tracks as track
    on track.snapshot_id = snapshot.id
  where snapshot.total_tracks = 200
    and nullif(btrim(snapshot.source), '') is not null
  group by
    snapshot.id,
    snapshot.country,
    snapshot.chart_type,
    snapshot.chart_date,
    snapshot.total_tracks,
    snapshot.imported_at
) as integrity
where integrity.tracks_count = 200
  and integrity.unique_positions = 200
  and integrity.unique_track_ids = 200
  and integrity.min_position = 1
  and integrity.max_position = 200
  and integrity.invalid_rows = 0;

revoke all on table public.spotify_chart_complete_snapshots
  from public, anon, authenticated;
grant select on table public.spotify_chart_complete_snapshots
  to authenticated, service_role;

-- The original refresh procedure counted persisted coverage independently from
-- queue state. Normalize a premature completion before constraints are checked.
create or replace function private.spotify_chart_backfill_completion_gate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.status = 'completed'
    and (
      new.expected_job_count = 0
      or new.linked_job_count <> new.expected_job_count
      or new.covered_job_count <> new.expected_job_count
      or new.pending_job_count <> 0
      or new.retry_pending_job_count <> 0
      or new.running_job_count <> 0
      or new.failed_job_count <> 0
    )
  then
    new.status := case
      when new.pending_job_count > 0 or new.running_job_count > 0
        then 'running'
      else 'blocked'
    end;
    new.completed_at := null;
    new.approved_at := null;
    new.last_error := case
      when new.status = 'blocked'
        then 'A fila terminou sem satisfazer integralmente o contrato Top 200.'
      else null
    end;
  end if;

  return new;
end
$function$;

revoke all on function private.spotify_chart_backfill_completion_gate()
  from public, anon, authenticated;

drop trigger if exists spotify_chart_backfill_completion_gate
  on public.spotify_chart_backfill_campaigns;

create trigger spotify_chart_backfill_completion_gate
  before update on public.spotify_chart_backfill_campaigns
  for each row
  execute function private.spotify_chart_backfill_completion_gate();

alter table public.spotify_chart_backfill_campaigns
  drop constraint if exists spotify_chart_backfill_campaigns_completion_check;

alter table public.spotify_chart_backfill_campaigns
  add constraint spotify_chart_backfill_campaigns_completion_check
  check (
    status <> 'completed'
    or (
      expected_job_count > 0
      and linked_job_count = expected_job_count
      and covered_job_count = expected_job_count
      and pending_job_count = 0
      and retry_pending_job_count = 0
      and running_job_count = 0
      and failed_job_count = 0
    )
  ) not valid;

-- The trigger above normalizes any completion produced by the former, weaker
-- coverage rule before the new invariant is validated against existing rows.
select count(*)
from public.refresh_spotify_chart_backfill_campaign_progress(null);

alter table public.spotify_chart_backfill_campaigns
  validate constraint spotify_chart_backfill_campaigns_completion_check;

-- A previously approved 30d rollout may have made 180d ready. After the strict
-- refresh, reinsert 60d as the mandatory gate and unlock only an eligible phase.
update public.spotify_chart_backfill_campaigns as campaign
set status = 'locked'
where campaign.rollout_key = 'spotify-charts-historical-v1'
  and campaign.phase_order > 10
  and campaign.started_at is null
  and campaign.status = 'ready';

with next_eligible as (
  select candidate.id
  from public.spotify_chart_backfill_campaigns as candidate
  where candidate.rollout_key = 'spotify-charts-historical-v1'
    and candidate.status = 'locked'
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

-- Anchor every longer window to the first persisted phase end date. Starting a
-- phase later therefore expands only backwards and never shifts the dataset.
create or replace function public.start_spotify_chart_backfill_campaign(
  p_phase_key text,
  p_end_date date default (current_date - 1),
  p_enable_regions boolean default false
)
returns public.spotify_chart_backfill_campaigns
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_campaign public.spotify_chart_backfill_campaigns;
  returned_campaign public.spotify_chart_backfill_campaigns;
  rollout_anchor_end_date date;
  start_date date;
  end_date date;
  region_count integer;
  linked_count integer;
begin
  if p_phase_key is null
    or p_phase_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'Invalid phase_key.';
  end if;

  if p_end_date is null or p_end_date >= current_date then
    raise exception 'end_date must be a completed UTC day.';
  end if;

  select campaign.*
  into target_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.phase_key = p_phase_key;

  if target_campaign.id is null then
    raise exception 'Unknown Spotify chart backfill phase: %', p_phase_key;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_campaign.rollout_key, 0)
  );

  select campaign.*
  into target_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.id = target_campaign.id
  for update;

  select anchor.target_end_date
  into rollout_anchor_end_date
  from public.spotify_chart_backfill_campaigns as anchor
  where anchor.rollout_key = target_campaign.rollout_key
    and anchor.target_end_date is not null
  order by anchor.phase_order
  limit 1;

  end_date := coalesce(
    rollout_anchor_end_date,
    target_campaign.target_end_date,
    p_end_date
  );

  if end_date >= current_date then
    raise exception 'The rollout anchor must be a completed UTC day.';
  end if;

  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as anchored
    where anchored.rollout_key = target_campaign.rollout_key
      and anchored.target_end_date is not null
      and anchored.target_end_date <> end_date
  ) then
    raise exception 'Persisted campaign end date diverges from the rollout anchor.';
  end if;

  if target_campaign.target_end_date is not null
    and target_campaign.target_end_date <> end_date
  then
    raise exception 'Campaign end date diverges from the rollout anchor.';
  end if;

  start_date := end_date - (target_campaign.window_days - 1);

  if target_campaign.target_start_date is not null
    and target_campaign.target_start_date <> start_date
  then
    raise exception 'Campaign start date diverges from its anchored window.';
  end if;

  if target_campaign.status in ('running', 'completed') then
    return target_campaign;
  end if;

  if target_campaign.status = 'cancelled' then
    raise exception 'Cancelled campaigns cannot be restarted.';
  end if;

  if exists (
    select 1
    from public.spotify_chart_backfill_campaigns as predecessor
    where predecessor.rollout_key = target_campaign.rollout_key
      and predecessor.phase_order < target_campaign.phase_order
      and (
        predecessor.status <> 'completed'
        or predecessor.approved_at is null
      )
  ) then
    raise exception 'Previous phases must be completed and approved first.';
  end if;

  if p_enable_regions then
    update public.spotify_chart_regions as region
    set enabled = true, backfill_enabled = true
    where exists (
      select 1
      from public.spotify_chart_backfill_campaign_regions as campaign_region
      where campaign_region.campaign_id = target_campaign.id
        and campaign_region.region_id = region.region_key
    );
  end if;

  if exists (
    select 1
    from public.spotify_chart_backfill_campaign_regions as campaign_region
    join public.spotify_chart_regions as region
      on region.region_key = campaign_region.region_id
    where campaign_region.campaign_id = target_campaign.id
      and (not region.enabled or not region.backfill_enabled)
  ) then
    raise exception 'All campaign regions must be enabled for backfill.';
  end if;

  select count(*)::integer
  into region_count
  from public.spotify_chart_backfill_campaign_regions as campaign_region
  where campaign_region.campaign_id = target_campaign.id;

  if region_count = 0 then
    raise exception 'Campaign has no regions.';
  end if;

  insert into public.spotify_chart_backfill_jobs (
    region_id,
    chart_type,
    period,
    target_date
  )
  select
    campaign_region.region_id,
    target_campaign.chart_type,
    target_campaign.period,
    day::date
  from public.spotify_chart_backfill_campaign_regions as campaign_region
  cross join generate_series(
    start_date::timestamp,
    end_date::timestamp,
    interval '1 day'
  ) as day
  where campaign_region.campaign_id = target_campaign.id
  on conflict (region_id, chart_type, period, target_date) do nothing;

  insert into public.spotify_chart_backfill_campaign_jobs (
    campaign_id,
    job_id
  )
  select target_campaign.id, job.id
  from public.spotify_chart_backfill_jobs as job
  join public.spotify_chart_backfill_campaign_regions as campaign_region
    on campaign_region.campaign_id = target_campaign.id
    and campaign_region.region_id = job.region_id
  where job.chart_type = target_campaign.chart_type
    and job.period = target_campaign.period
    and job.target_date between start_date and end_date
  on conflict (campaign_id, job_id) do nothing;

  select count(*)::integer
  into linked_count
  from public.spotify_chart_backfill_campaign_jobs as campaign_job
  where campaign_job.campaign_id = target_campaign.id;

  if linked_count <> target_campaign.window_days * region_count then
    raise exception
      'Campaign seed is incomplete: expected %, linked %.',
      target_campaign.window_days * region_count,
      linked_count;
  end if;

  update public.spotify_chart_backfill_campaigns as campaign
  set
    target_start_date = start_date,
    target_end_date = end_date,
    expected_job_count = target_campaign.window_days * region_count,
    linked_job_count = linked_count,
    status = 'running',
    started_at = coalesce(campaign.started_at, now()),
    last_error = null
  where campaign.id = target_campaign.id
  returning campaign.* into returned_campaign;

  insert into public.spotify_chart_backfill_campaign_logs (
    campaign_id,
    event_type,
    previous_status,
    current_status,
    metrics,
    message
  )
  values (
    returned_campaign.id,
    case when target_campaign.status = 'paused' then 'resumed' else 'started' end,
    target_campaign.status,
    returned_campaign.status,
    jsonb_build_object(
      'start_date', returned_campaign.target_start_date,
      'end_date', returned_campaign.target_end_date,
      'expected_jobs', returned_campaign.expected_job_count,
      'linked_jobs', returned_campaign.linked_job_count,
      'rollout_anchor_end_date', end_date
    ),
    null
  );

  perform *
  from public.refresh_spotify_chart_backfill_campaign_progress(p_phase_key);

  select campaign.*
  into returned_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.id = target_campaign.id;

  return returned_campaign;
end
$function$;

revoke all on function public.start_spotify_chart_backfill_campaign(
  text,
  date,
  boolean
) from public, anon, authenticated;
grant execute on function public.start_spotify_chart_backfill_campaign(
  text,
  date,
  boolean
) to service_role;

-- Approval is idempotent: only the immediate successor may become ready, and
-- that phase must have every predecessor completed and approved.
create or replace function public.approve_spotify_chart_backfill_campaign(
  p_phase_key text
)
returns public.spotify_chart_backfill_campaigns
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_campaign public.spotify_chart_backfill_campaigns;
  approved_campaign public.spotify_chart_backfill_campaigns;
  is_first_approval boolean;
begin
  if p_phase_key is null
    or p_phase_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'Invalid phase_key.';
  end if;

  select campaign.*
  into target_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.phase_key = p_phase_key;

  if target_campaign.id is null then
    raise exception 'Unknown Spotify chart backfill phase: %', p_phase_key;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_campaign.rollout_key, 0)
  );

  perform *
  from public.refresh_spotify_chart_backfill_campaign_progress(p_phase_key);

  select campaign.*
  into target_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.id = target_campaign.id
  for update;

  if target_campaign.status <> 'completed'
    or target_campaign.expected_job_count = 0
    or target_campaign.linked_job_count <> target_campaign.expected_job_count
    or target_campaign.covered_job_count <> target_campaign.expected_job_count
    or target_campaign.pending_job_count <> 0
    or target_campaign.retry_pending_job_count <> 0
    or target_campaign.running_job_count <> 0
    or target_campaign.failed_job_count <> 0
  then
    raise exception 'Campaign is not stable enough to approve.';
  end if;

  is_first_approval := target_campaign.approved_at is null;

  update public.spotify_chart_backfill_campaigns as campaign
  set approved_at = coalesce(campaign.approved_at, now())
  where campaign.id = target_campaign.id
  returning campaign.* into approved_campaign;

  with immediate_successor as (
    select candidate.id
    from public.spotify_chart_backfill_campaigns as candidate
    where candidate.rollout_key = approved_campaign.rollout_key
      and candidate.phase_order > approved_campaign.phase_order
    order by candidate.phase_order
    limit 1
  )
  update public.spotify_chart_backfill_campaigns as next_campaign
  set status = 'ready'
  from immediate_successor
  where next_campaign.id = immediate_successor.id
    and next_campaign.status = 'locked'
    and not exists (
      select 1
      from public.spotify_chart_backfill_campaigns as predecessor
      where predecessor.rollout_key = next_campaign.rollout_key
        and predecessor.phase_order < next_campaign.phase_order
        and (
          predecessor.status <> 'completed'
          or predecessor.approved_at is null
        )
    );

  if is_first_approval then
    insert into public.spotify_chart_backfill_campaign_logs (
      campaign_id,
      event_type,
      previous_status,
      current_status,
      metrics,
      message
    )
    values (
      approved_campaign.id,
      'approved',
      approved_campaign.status,
      approved_campaign.status,
      jsonb_build_object(
        'covered', approved_campaign.covered_job_count,
        'expected', approved_campaign.expected_job_count,
        'progress_percent', approved_campaign.progress_percent
      ),
      'Stability gate approved; the next eligible phase is ready.'
    );
  end if;

  return approved_campaign;
end
$function$;

revoke all on function public.approve_spotify_chart_backfill_campaign(text)
  from public, anon, authenticated;
grant execute on function public.approve_spotify_chart_backfill_campaign(text)
  to service_role;

-- The phase key is explicit through peek -> source probe -> claim. This removes
-- the temporary core-30d pin while keeping every campaign boundary check.
drop function if exists public.peek_spotify_chart_backfill_jobs(integer);

create or replace function public.peek_spotify_chart_backfill_jobs(
  p_limit integer default 3,
  p_phase_key text default null
)
returns setof public.spotify_chart_backfill_jobs
language sql
stable
security invoker
set search_path = ''
as $function$
  select job.*
  from public.spotify_chart_backfill_jobs as job
  join public.spotify_chart_regions as region
    on region.region_key = job.region_id
  where job.status = 'pending'
    and job.next_attempt_at <= now()
    and job.attempts < job.max_attempts
    and job.target_date <= current_date
    and region.enabled
    and region.backfill_enabled
    and exists (
      select 1
      from public.spotify_chart_backfill_campaign_jobs as campaign_job
      join public.spotify_chart_backfill_campaigns as campaign
        on campaign.id = campaign_job.campaign_id
      where campaign_job.job_id = job.id
        and campaign.rollout_key = 'spotify-charts-historical-v1'
        and campaign.status = 'running'
        and (p_phase_key is null or campaign.phase_key = p_phase_key)
        and campaign.chart_type = job.chart_type
        and campaign.period = job.period
        and job.target_date between
          campaign.target_start_date and campaign.target_end_date
        and exists (
          select 1
          from public.spotify_chart_backfill_campaign_regions as campaign_region
          where campaign_region.campaign_id = campaign.id
            and campaign_region.region_id = job.region_id
        )
    )
  order by
    job.target_date desc,
    region.priority asc,
    job.created_at asc,
    job.id asc
  limit least(greatest(coalesce(p_limit, 3), 1), 10);
$function$;

revoke all on function public.peek_spotify_chart_backfill_jobs(integer, text)
  from public, anon, authenticated;
grant execute on function public.peek_spotify_chart_backfill_jobs(integer, text)
  to service_role;

drop function if exists public.claim_spotify_chart_backfill_job_by_id(
  uuid,
  text,
  integer
);

create or replace function public.claim_spotify_chart_backfill_job_by_id(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 300,
  p_phase_key text default null
)
returns public.spotify_chart_backfill_jobs
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  claimed_job public.spotify_chart_backfill_jobs;
begin
  if p_job_id is null then
    raise exception 'job_id is required.';
  end if;

  if nullif(btrim(p_worker_id), '') is null
    or char_length(p_worker_id) > 128
  then
    raise exception 'worker_id must contain between 1 and 128 characters.';
  end if;

  if p_lease_seconds is null
    or p_lease_seconds < 60
    or p_lease_seconds > 900
  then
    raise exception 'lease_seconds must be between 60 and 900.';
  end if;

  if p_phase_key is not null
    and p_phase_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'Invalid phase_key.';
  end if;

  with candidate as (
    select job.id
    from public.spotify_chart_backfill_jobs as job
    join public.spotify_chart_regions as region
      on region.region_key = job.region_id
    where job.id = p_job_id
      and job.status = 'pending'
      and job.next_attempt_at <= now()
      and job.attempts < job.max_attempts
      and job.target_date <= current_date
      and region.enabled
      and region.backfill_enabled
      and exists (
        select 1
        from public.spotify_chart_backfill_campaign_jobs as campaign_job
        join public.spotify_chart_backfill_campaigns as campaign
          on campaign.id = campaign_job.campaign_id
        where campaign_job.job_id = job.id
          and campaign.rollout_key = 'spotify-charts-historical-v1'
          and campaign.status = 'running'
          and (p_phase_key is null or campaign.phase_key = p_phase_key)
          and campaign.chart_type = job.chart_type
          and campaign.period = job.period
          and job.target_date between
            campaign.target_start_date and campaign.target_end_date
          and exists (
            select 1
            from public.spotify_chart_backfill_campaign_regions as campaign_region
            where campaign_region.campaign_id = campaign.id
              and campaign_region.region_id = job.region_id
          )
      )
    for update of job skip locked
  )
  update public.spotify_chart_backfill_jobs as job
  set
    status = 'running',
    worker_id = btrim(p_worker_id),
    lease_token = gen_random_uuid(),
    lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  from candidate
  where job.id = candidate.id
  returning job.* into claimed_job;

  return claimed_job;
end
$function$;

revoke all on function public.claim_spotify_chart_backfill_job_by_id(
  uuid,
  text,
  integer,
  text
) from public, anon, authenticated;
grant execute on function public.claim_spotify_chart_backfill_job_by_id(
  uuid,
  text,
  integer,
  text
) to service_role;
