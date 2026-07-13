-- Gradual, explicitly approved Spotify Charts historical rollout.
-- Jobs remain globally idempotent; overlapping phases reuse them through M:N.

create table public.spotify_chart_backfill_campaigns (
  id uuid primary key default gen_random_uuid(),
  rollout_key text not null,
  phase_key text not null unique,
  phase_order smallint not null,
  name text not null,
  chart_type text not null default 'top-songs',
  period text not null default 'daily',
  window_days integer not null,
  target_start_date date,
  target_end_date date,
  status text not null default 'locked',
  expected_job_count integer not null default 0,
  linked_job_count integer not null default 0,
  covered_job_count integer not null default 0,
  pending_job_count integer not null default 0,
  retry_pending_job_count integer not null default 0,
  running_job_count integer not null default 0,
  success_job_count integer not null default 0,
  failed_job_count integer not null default 0,
  skipped_job_count integer not null default 0,
  progress_percent numeric(5, 2) not null default 0,
  last_error text,
  last_evaluated_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spotify_chart_backfill_campaigns_rollout_order_key
    unique (rollout_key, phase_order),
  constraint spotify_chart_backfill_campaigns_rollout_key_check
    check (rollout_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint spotify_chart_backfill_campaigns_phase_key_check
    check (phase_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint spotify_chart_backfill_campaigns_phase_order_check
    check (phase_order > 0),
  constraint spotify_chart_backfill_campaigns_name_check
    check (nullif(btrim(name), '') is not null),
  constraint spotify_chart_backfill_campaigns_chart_type_check
    check (chart_type = 'top-songs'),
  constraint spotify_chart_backfill_campaigns_period_check
    check (period = 'daily'),
  constraint spotify_chart_backfill_campaigns_window_days_check
    check (window_days between 1 and 365),
  constraint spotify_chart_backfill_campaigns_dates_check
    check (
      (target_start_date is null and target_end_date is null)
      or (
        target_start_date is not null
        and target_end_date is not null
        and target_start_date <= target_end_date
      )
    ),
  constraint spotify_chart_backfill_campaigns_status_check
    check (
      status in (
        'locked',
        'ready',
        'running',
        'paused',
        'completed',
        'blocked',
        'cancelled'
      )
    ),
  constraint spotify_chart_backfill_campaigns_counts_check
    check (
      expected_job_count >= 0
      and linked_job_count >= 0
      and covered_job_count >= 0
      and pending_job_count >= 0
      and retry_pending_job_count >= 0
      and running_job_count >= 0
      and success_job_count >= 0
      and failed_job_count >= 0
      and skipped_job_count >= 0
      and progress_percent between 0 and 100
    )
);

comment on table public.spotify_chart_backfill_campaigns is
  'Server-only gradual rollout phases for Spotify Charts historical backfill.';
comment on column public.spotify_chart_backfill_campaigns.approved_at is
  'Explicit stability approval required before the next phase can start.';
comment on column public.spotify_chart_backfill_campaigns.covered_job_count is
  'Jobs backed by a complete calendar snapshot, independent of queue outcome.';

create unique index spotify_chart_backfill_one_running_campaign_idx
  on public.spotify_chart_backfill_campaigns (rollout_key)
  where status = 'running';

create index spotify_chart_backfill_campaigns_status_order_idx
  on public.spotify_chart_backfill_campaigns (
    rollout_key,
    status,
    phase_order
  );

create table public.spotify_chart_backfill_campaign_regions (
  campaign_id uuid not null,
  region_id text not null,
  created_at timestamptz not null default now(),
  primary key (campaign_id, region_id),
  constraint spotify_chart_backfill_campaign_regions_campaign_fkey
    foreign key (campaign_id)
    references public.spotify_chart_backfill_campaigns(id)
    on delete restrict,
  constraint spotify_chart_backfill_campaign_regions_region_fkey
    foreign key (region_id)
    references public.spotify_chart_regions(region_key)
    on delete restrict
);

create index spotify_chart_backfill_campaign_regions_region_idx
  on public.spotify_chart_backfill_campaign_regions (region_id, campaign_id);

create table public.spotify_chart_backfill_campaign_jobs (
  campaign_id uuid not null,
  job_id uuid not null,
  linked_at timestamptz not null default now(),
  primary key (campaign_id, job_id),
  constraint spotify_chart_backfill_campaign_jobs_campaign_fkey
    foreign key (campaign_id)
    references public.spotify_chart_backfill_campaigns(id)
    on delete restrict,
  constraint spotify_chart_backfill_campaign_jobs_job_fkey
    foreign key (job_id)
    references public.spotify_chart_backfill_jobs(id)
    on delete restrict
);

create index spotify_chart_backfill_campaign_jobs_job_idx
  on public.spotify_chart_backfill_campaign_jobs (job_id, campaign_id);

create table public.spotify_chart_backfill_campaign_logs (
  id bigint generated always as identity primary key,
  campaign_id uuid not null,
  event_type text not null,
  previous_status text,
  current_status text not null,
  metrics jsonb not null default '{}'::jsonb,
  message text,
  created_at timestamptz not null default now(),
  constraint spotify_chart_backfill_campaign_logs_campaign_fkey
    foreign key (campaign_id)
    references public.spotify_chart_backfill_campaigns(id)
    on delete restrict,
  constraint spotify_chart_backfill_campaign_logs_event_type_check
    check (
      event_type in (
        'started',
        'progress',
        'paused',
        'resumed',
        'completed',
        'blocked',
        'approved'
      )
    )
);

create index spotify_chart_backfill_campaign_logs_campaign_created_idx
  on public.spotify_chart_backfill_campaign_logs (
    campaign_id,
    created_at desc
  );

-- Calendar and campaign coverage must only expose structurally complete dates.
create or replace view public.spotify_chart_complete_snapshots
with (security_invoker = true)
as
select
  snapshot.id as snapshot_id,
  snapshot.country,
  snapshot.chart_type,
  snapshot.chart_date,
  snapshot.total_tracks,
  track_count.tracks_count,
  snapshot.imported_at
from public.chart_snapshots as snapshot
join lateral (
  select count(*)::integer as tracks_count
  from public.chart_snapshot_tracks as track
  where track.snapshot_id = snapshot.id
) as track_count on true
where snapshot.total_tracks > 0
  and track_count.tracks_count = snapshot.total_tracks;

revoke all on table public.spotify_chart_complete_snapshots
  from public, anon, authenticated;
grant select on table public.spotify_chart_complete_snapshots
  to authenticated, service_role;

create or replace function private.spotify_chart_backfill_campaign_touch()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

revoke all on function private.spotify_chart_backfill_campaign_touch()
  from public, anon, authenticated;

create trigger spotify_chart_backfill_campaign_touch
  before update on public.spotify_chart_backfill_campaigns
  for each row
  execute function private.spotify_chart_backfill_campaign_touch();

alter table public.spotify_chart_backfill_campaigns enable row level security;
alter table public.spotify_chart_backfill_campaign_regions enable row level security;
alter table public.spotify_chart_backfill_campaign_jobs enable row level security;
alter table public.spotify_chart_backfill_campaign_logs enable row level security;

revoke all on table public.spotify_chart_backfill_campaigns
  from public, anon, authenticated;
revoke all on table public.spotify_chart_backfill_campaign_regions
  from public, anon, authenticated;
revoke all on table public.spotify_chart_backfill_campaign_jobs
  from public, anon, authenticated;
revoke all on table public.spotify_chart_backfill_campaign_logs
  from public, anon, authenticated;

grant select, insert, update on table public.spotify_chart_backfill_campaigns
  to service_role;
grant select, insert, update on table public.spotify_chart_backfill_campaign_regions
  to service_role;
grant select, insert on table public.spotify_chart_backfill_campaign_jobs
  to service_role;
grant select, insert on table public.spotify_chart_backfill_campaign_logs
  to service_role;
grant usage, select on sequence public.spotify_chart_backfill_campaign_logs_id_seq
  to service_role;

insert into public.spotify_chart_backfill_campaigns (
  rollout_key,
  phase_key,
  phase_order,
  name,
  window_days,
  status
)
values
  (
    'spotify-charts-historical-v1',
    'core-30d',
    10,
    'BR + Global — 30 dias',
    30,
    'ready'
  ),
  (
    'spotify-charts-historical-v1',
    'core-180d',
    20,
    'BR + Global — 6 meses',
    180,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'core-365d',
    30,
    'BR + Global — 1 ano',
    365,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'cities-30d',
    40,
    'SP + RJ + Porto Alegre — 30 dias',
    30,
    'locked'
  ),
  (
    'spotify-charts-historical-v1',
    'cities-180d',
    50,
    'SP + RJ + Porto Alegre — 6 meses',
    180,
    'locked'
  )
on conflict (phase_key) do nothing;

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
    ('core-180d', 'BR'),
    ('core-180d', 'GLOBAL'),
    ('core-365d', 'BR'),
    ('core-365d', 'GLOBAL'),
    ('cities-30d', 'BR-SP-SAO-PAULO'),
    ('cities-30d', 'BR-RJ-RIO-DE-JANEIRO'),
    ('cities-30d', 'BR-RS-PORTO-ALEGRE'),
    ('cities-180d', 'BR-SP-SAO-PAULO'),
    ('cities-180d', 'BR-RJ-RIO-DE-JANEIRO'),
    ('cities-180d', 'BR-RS-PORTO-ALEGRE')
) as region(phase_key, region_id)
  on region.phase_key = campaign.phase_key
on conflict (campaign_id, region_id) do nothing;

create or replace function public.refresh_spotify_chart_backfill_campaign_progress(
  p_phase_key text default null
)
returns setof public.spotify_chart_backfill_campaigns
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_campaign public.spotify_chart_backfill_campaigns;
  refreshed_campaign public.spotify_chart_backfill_campaigns;
  linked_count integer;
  covered_count integer;
  pending_count integer;
  retry_pending_count integer;
  running_count integer;
  success_count integer;
  failed_count integer;
  skipped_count integer;
  unsatisfied_terminal_count integer;
  next_status text;
  next_progress numeric(5, 2);
begin
  if p_phase_key is not null
    and p_phase_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'Invalid phase_key.';
  end if;

  for current_campaign in
    select campaign.*
    from public.spotify_chart_backfill_campaigns as campaign
    where p_phase_key is null or campaign.phase_key = p_phase_key
    order by campaign.phase_order
    for update
  loop
    select
      count(*)::integer,
      count(complete.snapshot_id)::integer,
      count(*) filter (where job.status = 'pending')::integer,
      count(*) filter (
        where job.status = 'pending' and job.attempts > 0
      )::integer,
      count(*) filter (where job.status = 'running')::integer,
      count(*) filter (where job.status = 'success')::integer,
      count(*) filter (where job.status = 'failed')::integer,
      count(*) filter (where job.status = 'skipped')::integer,
      count(*) filter (
        where job.status in ('success', 'failed', 'skipped')
          and complete.snapshot_id is null
      )::integer
    into
      linked_count,
      covered_count,
      pending_count,
      retry_pending_count,
      running_count,
      success_count,
      failed_count,
      skipped_count,
      unsatisfied_terminal_count
    from public.spotify_chart_backfill_campaign_jobs as campaign_job
    join public.spotify_chart_backfill_jobs as job
      on job.id = campaign_job.job_id
    left join public.spotify_chart_complete_snapshots as complete
      on complete.country = job.region_id
      and complete.chart_type = job.chart_type
      and complete.chart_date = job.target_date
    where campaign_job.campaign_id = current_campaign.id;

    next_progress := case
      when current_campaign.expected_job_count = 0 then 0
      else least(
        100,
        round(
          covered_count::numeric
          * 100
          / current_campaign.expected_job_count,
          2
        )
      )
    end;

    next_status := case
      when current_campaign.status in ('locked', 'ready', 'paused', 'cancelled')
        then current_campaign.status
      when current_campaign.expected_job_count > 0
        and linked_count = current_campaign.expected_job_count
        and covered_count = current_campaign.expected_job_count
        then 'completed'
      when linked_count = current_campaign.expected_job_count
        and pending_count = 0
        and running_count = 0
        and unsatisfied_terminal_count > 0
        then 'blocked'
      else 'running'
    end;

    update public.spotify_chart_backfill_campaigns as campaign
    set
      linked_job_count = linked_count,
      covered_job_count = covered_count,
      pending_job_count = pending_count,
      retry_pending_job_count = retry_pending_count,
      running_job_count = running_count,
      success_job_count = success_count,
      failed_job_count = failed_count,
      skipped_job_count = skipped_count,
      progress_percent = next_progress,
      status = next_status,
      last_error = case
        when next_status = 'blocked'
          then 'Existem datas terminais sem snapshot completo no calendario.'
        else null
      end,
      last_evaluated_at = now(),
      completed_at = case
        when next_status = 'completed'
          then coalesce(campaign.completed_at, now())
        else null
      end,
      approved_at = case
        when next_status = 'completed' then campaign.approved_at
        else null
      end
    where campaign.id = current_campaign.id
    returning campaign.* into refreshed_campaign;

    if current_campaign.status is distinct from refreshed_campaign.status
      or current_campaign.covered_job_count
        is distinct from refreshed_campaign.covered_job_count
      or current_campaign.pending_job_count
        is distinct from refreshed_campaign.pending_job_count
      or current_campaign.running_job_count
        is distinct from refreshed_campaign.running_job_count
      or current_campaign.failed_job_count
        is distinct from refreshed_campaign.failed_job_count
    then
      insert into public.spotify_chart_backfill_campaign_logs (
        campaign_id,
        event_type,
        previous_status,
        current_status,
        metrics,
        message
      )
      values (
        refreshed_campaign.id,
        case
          when refreshed_campaign.status = 'completed' then 'completed'
          when refreshed_campaign.status = 'blocked' then 'blocked'
          else 'progress'
        end,
        current_campaign.status,
        refreshed_campaign.status,
        jsonb_build_object(
          'expected', refreshed_campaign.expected_job_count,
          'linked', refreshed_campaign.linked_job_count,
          'covered', refreshed_campaign.covered_job_count,
          'pending', refreshed_campaign.pending_job_count,
          'retry_pending', refreshed_campaign.retry_pending_job_count,
          'running', refreshed_campaign.running_job_count,
          'success', refreshed_campaign.success_job_count,
          'failed', refreshed_campaign.failed_job_count,
          'skipped', refreshed_campaign.skipped_job_count,
          'progress_percent', refreshed_campaign.progress_percent
        ),
        refreshed_campaign.last_error
      );
    end if;

    return next refreshed_campaign;
  end loop;

  return;
end
$function$;

revoke all on function public.refresh_spotify_chart_backfill_campaign_progress(text)
  from public, anon, authenticated;
grant execute on function public.refresh_spotify_chart_backfill_campaign_progress(text)
  to service_role;

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

  end_date := coalesce(target_campaign.target_end_date, p_end_date);
  start_date := coalesce(
    target_campaign.target_start_date,
    end_date - (target_campaign.window_days - 1)
  );

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
    target_start_date = coalesce(campaign.target_start_date, start_date),
    target_end_date = coalesce(campaign.target_end_date, end_date),
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
      'linked_jobs', returned_campaign.linked_job_count
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
begin
  perform *
  from public.refresh_spotify_chart_backfill_campaign_progress(p_phase_key);

  select campaign.*
  into target_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.phase_key = p_phase_key
  for update;

  if target_campaign.id is null then
    raise exception 'Unknown Spotify chart backfill phase: %', p_phase_key;
  end if;

  if target_campaign.status <> 'completed'
    or target_campaign.expected_job_count = 0
    or target_campaign.linked_job_count <> target_campaign.expected_job_count
    or target_campaign.covered_job_count <> target_campaign.expected_job_count
    or target_campaign.pending_job_count <> 0
    or target_campaign.running_job_count <> 0
    or target_campaign.failed_job_count <> 0
  then
    raise exception 'Campaign is not stable enough to approve.';
  end if;

  update public.spotify_chart_backfill_campaigns as campaign
  set approved_at = coalesce(campaign.approved_at, now())
  where campaign.id = target_campaign.id
  returning campaign.* into approved_campaign;

  update public.spotify_chart_backfill_campaigns as next_campaign
  set status = 'ready'
  where next_campaign.id = (
    select candidate.id
    from public.spotify_chart_backfill_campaigns as candidate
    where candidate.rollout_key = approved_campaign.rollout_key
      and candidate.phase_order > approved_campaign.phase_order
      and candidate.status = 'locked'
    order by candidate.phase_order
    limit 1
  );

  if target_campaign.approved_at is null then
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
      'Stability gate approved; the next phase is ready.'
    );
  end if;

  return approved_campaign;
end
$function$;

revoke all on function public.approve_spotify_chart_backfill_campaign(text)
  from public, anon, authenticated;
grant execute on function public.approve_spotify_chart_backfill_campaign(text)
  to service_role;

create or replace function public.set_spotify_chart_backfill_campaign_paused(
  p_phase_key text,
  p_paused boolean
)
returns public.spotify_chart_backfill_campaigns
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_campaign public.spotify_chart_backfill_campaigns;
  returned_campaign public.spotify_chart_backfill_campaigns;
begin
  if p_paused is null then
    raise exception 'paused is required.';
  end if;

  select campaign.*
  into target_campaign
  from public.spotify_chart_backfill_campaigns as campaign
  where campaign.phase_key = p_phase_key
  for update;

  if target_campaign.id is null then
    raise exception 'Unknown Spotify chart backfill phase: %', p_phase_key;
  end if;

  if p_paused and target_campaign.status not in ('running', 'blocked') then
    raise exception 'Only running or blocked campaigns can be paused.';
  end if;

  if not p_paused and target_campaign.status <> 'paused' then
    raise exception 'Only paused campaigns can be resumed.';
  end if;

  update public.spotify_chart_backfill_campaigns as campaign
  set status = case when p_paused then 'paused' else 'running' end
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
    case when p_paused then 'paused' else 'resumed' end,
    target_campaign.status,
    returned_campaign.status,
    jsonb_build_object(
      'covered', returned_campaign.covered_job_count,
      'expected', returned_campaign.expected_job_count,
      'progress_percent', returned_campaign.progress_percent
    ),
    null
  );

  return returned_campaign;
end
$function$;

revoke all on function public.set_spotify_chart_backfill_campaign_paused(
  text,
  boolean
) from public, anon, authenticated;
grant execute on function public.set_spotify_chart_backfill_campaign_paused(
  text,
  boolean
) to service_role;

-- Only active campaigns release their linked jobs. Legacy jobs without a
-- campaign stay compatible. Date-first ordering interleaves regions and avoids
-- draining all BR jobs before Global/cities.
create or replace function public.claim_spotify_chart_backfill_job(
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns public.spotify_chart_backfill_jobs
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  claimed_job public.spotify_chart_backfill_jobs;
begin
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

  with candidate as (
    select job.id
    from public.spotify_chart_backfill_jobs as job
    join public.spotify_chart_regions as region
      on region.region_key = job.region_id
    where job.status = 'pending'
      and job.next_attempt_at <= now()
      and job.attempts < job.max_attempts
      and job.target_date <= current_date
      and region.enabled
      and region.backfill_enabled
      and (
        not exists (
          select 1
          from public.spotify_chart_backfill_campaign_jobs as campaign_job
          where campaign_job.job_id = job.id
        )
        or exists (
          select 1
          from public.spotify_chart_backfill_campaign_jobs as campaign_job
          join public.spotify_chart_backfill_campaigns as campaign
            on campaign.id = campaign_job.campaign_id
          where campaign_job.job_id = job.id
            and campaign.status = 'running'
        )
      )
    order by
      job.target_date desc,
      region.priority asc,
      job.created_at asc,
      job.id asc
    for update of job skip locked
    limit 1
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

revoke all on function public.claim_spotify_chart_backfill_job(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_spotify_chart_backfill_job(text, integer)
  to service_role;
