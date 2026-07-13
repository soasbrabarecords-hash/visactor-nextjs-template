-- Adds short-lived leases and fencing to the inert backfill queue.
--
-- This migration still does not add or change any cron schedule. The worker
-- route claims only a small number of rows and all network work happens after
-- the claim transaction has committed.

alter table public.spotify_chart_backfill_jobs
  add column if not exists max_attempts integer not null default 3,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists worker_id text,
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

-- Jobs claimed by the pre-lease function cannot be fenced safely. Recover
-- them through the existing state machine before validating the new lease
-- constraint. Both transitions remain visible in the audit log.
update public.spotify_chart_backfill_jobs
set
  status = 'failed',
  last_error = 'Pre-lease running job recovered during worker migration.'
where status = 'running';

update public.spotify_chart_backfill_jobs
set
  status = 'pending',
  next_attempt_at = now() + interval '30 seconds'
where status = 'failed'
  and last_error = 'Pre-lease running job recovered during worker migration.'
  and attempts < max_attempts;

alter table public.spotify_chart_backfill_jobs
  add constraint spotify_chart_backfill_jobs_max_attempts_check
    check (max_attempts between 1 and 10),
  add constraint spotify_chart_backfill_jobs_worker_id_check
    check (
      worker_id is null
      or (
        nullif(btrim(worker_id), '') is not null
        and char_length(worker_id) <= 128
      )
    ),
  add constraint spotify_chart_backfill_jobs_lease_check
    check (
      (
        status = 'running'
        and worker_id is not null
        and lease_token is not null
        and lease_expires_at is not null
      )
      or (
        status <> 'running'
        and worker_id is null
        and lease_token is null
        and lease_expires_at is null
      )
    );

drop index if exists public.spotify_chart_backfill_jobs_pending_idx;
create index spotify_chart_backfill_jobs_pending_idx
  on public.spotify_chart_backfill_jobs (
    next_attempt_at,
    target_date,
    created_at,
    id
  )
  where status = 'pending';

create index if not exists spotify_chart_backfill_jobs_expired_lease_idx
  on public.spotify_chart_backfill_jobs (lease_expires_at, id)
  where status = 'running';

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
    new.worker_id = null;
    new.lease_token = null;
    new.lease_expires_at = null;
    new.next_attempt_at = coalesce(new.next_attempt_at, now());
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

    if new.status <> 'running' then
      new.worker_id = null;
      new.lease_token = null;
      new.lease_expires_at = null;
    elsif new.worker_id is distinct from old.worker_id
      or new.lease_token is distinct from old.lease_token
    then
      raise exception 'Worker identity and lease token are immutable.';
    end if;

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
    if old.attempts >= old.max_attempts then
      raise exception 'Spotify chart backfill job % exhausted its attempts.',
        old.id;
    end if;

    new.last_error = null;
    new.started_at = null;
    new.finished_at = null;
    new.worker_id = null;
    new.lease_token = null;
    new.lease_expires_at = null;
    new.next_attempt_at = coalesce(new.next_attempt_at, now());
  elsif new.status = 'running' then
    if old.attempts >= old.max_attempts then
      raise exception 'Spotify chart backfill job % exhausted its attempts.',
        old.id;
    end if;

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

    if nullif(btrim(new.worker_id), '') is null
      or new.lease_token is null
      or new.lease_expires_at is null
      or new.lease_expires_at <= now()
    then
      raise exception 'A running Spotify chart backfill job requires a valid lease.';
    end if;

    new.attempts = old.attempts + 1;
    new.last_error = null;
    new.started_at = now();
    new.finished_at = null;
  else
    new.finished_at = now();
    new.worker_id = null;
    new.lease_token = null;
    new.lease_expires_at = null;

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

drop function if exists public.claim_spotify_chart_backfill_job();

create function public.claim_spotify_chart_backfill_job(
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
    order by
      region.priority asc,
      job.target_date desc,
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

create or replace function public.settle_spotify_chart_backfill_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_error text default null
)
returns public.spotify_chart_backfill_jobs
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  settled_job public.spotify_chart_backfill_jobs;
begin
  if p_job_id is null or p_lease_token is null then
    raise exception 'job_id and lease_token are required.';
  end if;

  if p_outcome is null
    or p_outcome not in ('success', 'failed', 'skipped')
  then
    raise exception 'outcome must be success, failed or skipped.';
  end if;

  if p_outcome = 'failed' and nullif(btrim(p_error), '') is null then
    raise exception 'A failed job requires an error message.';
  end if;

  update public.spotify_chart_backfill_jobs as job
  set
    status = p_outcome,
    last_error = case
      when p_outcome = 'success' then null
      else nullif(left(btrim(p_error), 4000), '')
    end
  where job.id = p_job_id
    and job.status = 'running'
    and job.lease_token = p_lease_token
    and job.lease_expires_at > now()
  returning job.* into settled_job;

  -- Record each transient failure, then put it back behind a bounded delay.
  -- Unsupported permanent configurations are settled as skipped instead.
  if p_outcome = 'failed'
    and settled_job.id is not null
    and settled_job.attempts < settled_job.max_attempts
  then
    update public.spotify_chart_backfill_jobs as job
    set
      status = 'pending',
      next_attempt_at = now() + make_interval(
        secs => least(900, greatest(30, settled_job.attempts * 60))
      )
    where job.id = settled_job.id
      and job.status = 'failed'
    returning job.* into settled_job;
  end if;

  return settled_job;
end
$function$;

revoke all on function public.settle_spotify_chart_backfill_job(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.settle_spotify_chart_backfill_job(
  uuid,
  uuid,
  text,
  text
) to service_role;

create or replace function public.recover_spotify_chart_backfill_jobs(
  p_limit integer default 10
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  stale_job record;
  recovered_count integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 10 then
    raise exception 'limit must be between 1 and 10.';
  end if;

  for stale_job in
    select job.id, job.attempts, job.max_attempts
    from public.spotify_chart_backfill_jobs as job
    where job.status = 'running'
      and (
        job.lease_expires_at is null
        or job.lease_expires_at <= now()
      )
    order by job.lease_expires_at asc nulls first, job.started_at asc
    for update skip locked
    limit p_limit
  loop
    update public.spotify_chart_backfill_jobs
    set
      status = 'failed',
      last_error = 'Worker lease expired before the job was settled.'
    where id = stale_job.id
      and status = 'running';

    if stale_job.attempts < stale_job.max_attempts then
      update public.spotify_chart_backfill_jobs
      set
        status = 'pending',
        next_attempt_at = now() + interval '30 seconds'
      where id = stale_job.id
        and status = 'failed';
    end if;

    recovered_count := recovered_count + 1;
  end loop;

  return recovered_count;
end
$function$;

revoke all on function public.recover_spotify_chart_backfill_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.recover_spotify_chart_backfill_jobs(integer)
  to service_role;
