-- The strict Top 200 view is intentionally expensive: it validates every
-- persisted track, not only the snapshot header. The original progress RPC
-- joined that view once per campaign inside a PL/pgSQL loop, so an unscoped
-- refresh repeated the same integrity scan for every rollout phase.
--
-- Lock the selected campaigns first, materialize strict coverage once, and
-- calculate every campaign metric in one set-based statement. Status changes,
-- completion gates, logging, privileges, and the strict view remain unchanged.

create or replace function public.refresh_spotify_chart_backfill_campaign_progress(
  p_phase_key text default null
)
returns setof public.spotify_chart_backfill_campaigns
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  progress_row record;
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

  -- Keep the original row-lock contract, but acquire locks in rollout order
  -- before running the shared metrics statement.
  perform campaign.id
  from public.spotify_chart_backfill_campaigns as campaign
  where p_phase_key is null or campaign.phase_key = p_phase_key
  order by campaign.phase_order
  for update;

  for progress_row in
    with target_campaigns as materialized (
      select campaign.id
      from public.spotify_chart_backfill_campaigns as campaign
      where p_phase_key is null or campaign.phase_key = p_phase_key
    ), complete as materialized (
      select
        snapshot.snapshot_id,
        snapshot.country,
        snapshot.chart_type,
        snapshot.chart_date
      from public.spotify_chart_complete_snapshots as snapshot
    ), metrics as (
      select
        campaign_job.campaign_id,
        count(*)::integer as linked_count,
        count(complete.snapshot_id)::integer as covered_count,
        count(*) filter (
          where job.status = 'pending'
        )::integer as pending_count,
        count(*) filter (
          where job.status = 'pending' and job.attempts > 0
        )::integer as retry_pending_count,
        count(*) filter (
          where job.status = 'running'
        )::integer as running_count,
        count(*) filter (
          where job.status = 'success'
        )::integer as success_count,
        count(*) filter (
          where job.status = 'failed'
        )::integer as failed_count,
        count(*) filter (
          where job.status = 'skipped'
        )::integer as skipped_count,
        count(*) filter (
          where job.status in ('success', 'failed', 'skipped')
            and complete.snapshot_id is null
        )::integer as unsatisfied_terminal_count
      from target_campaigns
      join public.spotify_chart_backfill_campaign_jobs as campaign_job
        on campaign_job.campaign_id = target_campaigns.id
      join public.spotify_chart_backfill_jobs as job
        on job.id = campaign_job.job_id
      left join complete
        on complete.country = job.region_id
        and complete.chart_type = job.chart_type
        and complete.chart_date = job.target_date
      group by campaign_job.campaign_id
    )
    select
      campaign.*,
      coalesce(metrics.linked_count, 0)::integer
        as metric_linked_count,
      coalesce(metrics.covered_count, 0)::integer
        as metric_covered_count,
      coalesce(metrics.pending_count, 0)::integer
        as metric_pending_count,
      coalesce(metrics.retry_pending_count, 0)::integer
        as metric_retry_pending_count,
      coalesce(metrics.running_count, 0)::integer
        as metric_running_count,
      coalesce(metrics.success_count, 0)::integer
        as metric_success_count,
      coalesce(metrics.failed_count, 0)::integer
        as metric_failed_count,
      coalesce(metrics.skipped_count, 0)::integer
        as metric_skipped_count,
      coalesce(metrics.unsatisfied_terminal_count, 0)::integer
        as metric_unsatisfied_terminal_count
    from public.spotify_chart_backfill_campaigns as campaign
    left join metrics
      on metrics.campaign_id = campaign.id
    where p_phase_key is null or campaign.phase_key = p_phase_key
    order by campaign.phase_order
  loop
    linked_count := progress_row.metric_linked_count;
    covered_count := progress_row.metric_covered_count;
    pending_count := progress_row.metric_pending_count;
    retry_pending_count := progress_row.metric_retry_pending_count;
    running_count := progress_row.metric_running_count;
    success_count := progress_row.metric_success_count;
    failed_count := progress_row.metric_failed_count;
    skipped_count := progress_row.metric_skipped_count;
    unsatisfied_terminal_count :=
      progress_row.metric_unsatisfied_terminal_count;

    next_progress := case
      when progress_row.expected_job_count = 0 then 0
      else least(
        100,
        round(
          covered_count::numeric
          * 100
          / progress_row.expected_job_count,
          2
        )
      )
    end;

    next_status := case
      when progress_row.status in (
        'locked',
        'ready',
        'paused',
        'cancelled'
      ) then progress_row.status
      when progress_row.expected_job_count > 0
        and linked_count = progress_row.expected_job_count
        and covered_count = progress_row.expected_job_count
        then 'completed'
      when linked_count = progress_row.expected_job_count
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
    where campaign.id = progress_row.id
    returning campaign.* into refreshed_campaign;

    if progress_row.status is distinct from refreshed_campaign.status
      or progress_row.covered_job_count
        is distinct from refreshed_campaign.covered_job_count
      or progress_row.pending_job_count
        is distinct from refreshed_campaign.pending_job_count
      or progress_row.running_job_count
        is distinct from refreshed_campaign.running_job_count
      or progress_row.failed_job_count
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
        progress_row.status,
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

comment on function public.refresh_spotify_chart_backfill_campaign_progress(
  text
) is
  'Refreshes rollout progress with one shared strict Top 200 integrity scan per invocation.';

revoke all on function public.refresh_spotify_chart_backfill_campaign_progress(
  text
) from public, anon, authenticated;
grant execute on function public.refresh_spotify_chart_backfill_campaign_progress(
  text
) to service_role;
