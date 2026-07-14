-- Let the worker validate a historical source without consuming a queued job.
-- This rollout is intentionally pinned to the explicitly authorized core-30d
-- campaign. Orphan jobs and jobs linked only to another campaign are never
-- exposed or claimed. Both functions stay private to the service role even
-- though PostgREST exposes the public schema.

create or replace function public.peek_spotify_chart_backfill_jobs(
  p_limit integer default 3
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
        and campaign.phase_key = 'core-30d'
        and campaign.status = 'running'
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

revoke all on function public.peek_spotify_chart_backfill_jobs(integer)
  from public, anon, authenticated;
grant execute on function public.peek_spotify_chart_backfill_jobs(integer)
  to service_role;

create or replace function public.claim_spotify_chart_backfill_job_by_id(
  p_job_id uuid,
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
          and campaign.phase_key = 'core-30d'
          and campaign.status = 'running'
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
  integer
) from public, anon, authenticated;
grant execute on function public.claim_spotify_chart_backfill_job_by_id(
  uuid,
  text,
  integer
) to service_role;
