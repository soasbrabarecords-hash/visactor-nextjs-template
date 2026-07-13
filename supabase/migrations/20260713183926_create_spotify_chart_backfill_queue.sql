-- Inert historical backfill queue for Spotify Charts.
--
-- This migration intentionally does not create a worker, schedule, HTTP route,
-- or any connection to the existing 10:00 cron. One job represents exactly
-- one region + chart type + period + date, which keeps retries granular and
-- makes enqueueing the same range idempotent.

create table if not exists public.spotify_chart_backfill_jobs (
  id uuid primary key default gen_random_uuid(),
  region_id text not null,
  chart_type text not null,
  period text not null,
  target_date date not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint spotify_chart_backfill_jobs_region_fkey
    foreign key (region_id)
    references public.spotify_chart_regions(region_key)
    on update cascade
    on delete restrict,
  constraint spotify_chart_backfill_jobs_identity_key
    unique (region_id, chart_type, period, target_date),
  constraint spotify_chart_backfill_jobs_chart_type_check
    check (
      chart_type = lower(chart_type)
      and chart_type ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint spotify_chart_backfill_jobs_period_check
    check (
      period = lower(period)
      and period ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint spotify_chart_backfill_jobs_status_check
    check (status in ('pending', 'running', 'success', 'failed', 'skipped')),
  constraint spotify_chart_backfill_jobs_attempts_check
    check (attempts >= 0),
  constraint spotify_chart_backfill_jobs_failed_error_check
    check (
      status <> 'failed'
      or nullif(btrim(last_error), '') is not null
    ),
  constraint spotify_chart_backfill_jobs_timestamps_check
    check (
      (status = 'pending' and started_at is null and finished_at is null)
      or (status = 'running' and started_at is not null and finished_at is null)
      or (
        status in ('success', 'failed', 'skipped')
        and finished_at is not null
      )
    )
);

comment on table public.spotify_chart_backfill_jobs is
  'Server-only, idempotent historical Spotify Charts queue. It is not connected to the daily cron.';
comment on column public.spotify_chart_backfill_jobs.region_id is
  'Canonical spotify_chart_regions.region_key. backfill_enabled is the regional pause switch.';
comment on column public.spotify_chart_backfill_jobs.period is
  'Source period key, for example daily. It is part of the idempotency identity.';
comment on column public.spotify_chart_backfill_jobs.attempts is
  'Number of times the job has been atomically claimed for processing.';

create index if not exists spotify_chart_backfill_jobs_pending_idx
  on public.spotify_chart_backfill_jobs (target_date, created_at, id)
  where status = 'pending';

create index if not exists spotify_chart_backfill_jobs_status_updated_idx
  on public.spotify_chart_backfill_jobs (status, updated_at desc);

create table if not exists public.spotify_chart_backfill_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  status text not null,
  attempt integer not null default 0,
  message text,
  error_message text,
  created_at timestamptz not null default now(),

  constraint spotify_chart_backfill_job_logs_job_fkey
    foreign key (job_id)
    references public.spotify_chart_backfill_jobs(id)
    on update cascade
    on delete restrict,
  constraint spotify_chart_backfill_job_logs_status_check
    check (status in ('pending', 'running', 'success', 'failed', 'skipped')),
  constraint spotify_chart_backfill_job_logs_attempt_check
    check (attempt >= 0)
);

comment on table public.spotify_chart_backfill_job_logs is
  'Append-only status and error history for Spotify Charts backfill jobs.';

create index if not exists spotify_chart_backfill_job_logs_job_created_idx
  on public.spotify_chart_backfill_job_logs (job_id, created_at desc);

create schema if not exists private;

create or replace function private.spotify_chart_backfill_jobs_prepare()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.region_id = upper(btrim(new.region_id));
  new.chart_type = lower(btrim(new.chart_type));
  new.period = lower(btrim(new.period));
  new.updated_at = now();

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'New Spotify chart backfill jobs must start as pending.';
    end if;

    new.attempts = 0;
    new.last_error = null;
    new.started_at = null;
    new.finished_at = null;
    return new;
  end if;

  if new.region_id is distinct from old.region_id
    or new.chart_type is distinct from old.chart_type
    or new.period is distinct from old.period
    or new.target_date is distinct from old.target_date
  then
    raise exception 'Spotify chart backfill job identity is immutable.';
  end if;

  -- Attempts are owned by the state machine, never by callers.
  new.attempts = old.attempts;

  if new.status is not distinct from old.status then
    new.last_error = old.last_error;
    new.started_at = old.started_at;
    new.finished_at = old.finished_at;
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('running', 'skipped'))
    or (old.status = 'running' and new.status in ('success', 'failed', 'skipped'))
    or (old.status in ('failed', 'skipped') and new.status = 'pending')
  ) then
    raise exception 'Invalid Spotify chart backfill transition: % -> %.',
      old.status,
      new.status;
  end if;

  if new.status = 'pending' then
    new.last_error = null;
    new.started_at = null;
    new.finished_at = null;
  elsif new.status = 'running' then
    if not exists (
      select 1
      from public.spotify_chart_regions as region
      where region.region_key = new.region_id
        and region.enabled
        and region.backfill_enabled
    ) then
      raise exception 'Spotify chart backfill is paused or disabled for region %.',
        new.region_id;
    end if;

    new.attempts = old.attempts + 1;
    new.last_error = null;
    new.started_at = now();
    new.finished_at = null;
  else
    new.finished_at = now();

    if new.status = 'success' then
      new.last_error = null;
    elsif new.status = 'failed'
      and nullif(btrim(new.last_error), '') is null
    then
      raise exception 'A failed Spotify chart backfill job requires last_error.';
    end if;
  end if;

  return new;
end
$function$;

revoke all on function private.spotify_chart_backfill_jobs_prepare()
  from public, anon, authenticated;

drop trigger if exists spotify_chart_backfill_jobs_prepare
  on public.spotify_chart_backfill_jobs;
create trigger spotify_chart_backfill_jobs_prepare
  before insert or update on public.spotify_chart_backfill_jobs
  for each row
  execute function private.spotify_chart_backfill_jobs_prepare();

create or replace function private.spotify_chart_backfill_jobs_audit()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.attempts is not distinct from old.attempts
    and new.last_error is not distinct from old.last_error
  then
    return new;
  end if;

  insert into public.spotify_chart_backfill_job_logs (
    job_id,
    status,
    attempt,
    message,
    error_message
  )
  values (
    new.id,
    new.status,
    new.attempts,
    case
      when tg_op = 'INSERT' then 'Job enfileirado.'
      else format('Status alterado de %s para %s.', old.status, new.status)
    end,
    new.last_error
  );

  return new;
end
$function$;

revoke all on function private.spotify_chart_backfill_jobs_audit()
  from public, anon, authenticated;

drop trigger if exists spotify_chart_backfill_jobs_audit
  on public.spotify_chart_backfill_jobs;
create trigger spotify_chart_backfill_jobs_audit
  after insert or update of status, attempts, last_error
  on public.spotify_chart_backfill_jobs
  for each row
  execute function private.spotify_chart_backfill_jobs_audit();

-- Atomic, concurrency-safe reservation for a future dedicated worker.
-- No current route or cron calls this function.
create or replace function public.claim_spotify_chart_backfill_job()
returns public.spotify_chart_backfill_jobs
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  claimed_job public.spotify_chart_backfill_jobs;
begin
  with candidate as (
    select job.id
    from public.spotify_chart_backfill_jobs as job
    join public.spotify_chart_regions as region
      on region.region_key = job.region_id
    where job.status = 'pending'
      and region.enabled
      and region.backfill_enabled
    order by
      region.priority asc,
      job.target_date asc,
      job.created_at asc,
      job.id asc
    for update of job skip locked
    limit 1
  )
  update public.spotify_chart_backfill_jobs as job
  set status = 'running'
  from candidate
  where job.id = candidate.id
  returning job.* into claimed_job;

  return claimed_job;
end
$function$;

revoke all on function public.claim_spotify_chart_backfill_job()
  from public, anon, authenticated;
grant execute on function public.claim_spotify_chart_backfill_job()
  to service_role;

alter table public.spotify_chart_backfill_jobs enable row level security;
alter table public.spotify_chart_backfill_job_logs enable row level security;

-- These are internal operational records. A future admin UI must read them
-- through a server route that performs the existing backfill authorization.
revoke all privileges on table public.spotify_chart_backfill_jobs
  from public, anon, authenticated, service_role;
revoke all privileges on table public.spotify_chart_backfill_job_logs
  from public, anon, authenticated, service_role;

grant select, insert, update on table public.spotify_chart_backfill_jobs
  to service_role;
grant select, insert on table public.spotify_chart_backfill_job_logs
  to service_role;
