-- Playlists IA learning-agent persistence, schema contract v1.
--
-- This store is intentionally server-only. Browser-facing users never receive
-- table privileges or function execution. Atomic, retry-sensitive operations
-- are exposed through tightly scoped SECURITY DEFINER functions with an empty
-- search_path. Applying this migration does not create a cron or run training.

create schema if not exists private;

create table public.playlist_ai_recommendation_requests (
  request_id text primary key,
  workspace_id text not null,
  playlist_id text not null,
  playlist_name text not null,
  genre text not null default 'desconhecido',
  market text not null,
  as_of timestamptz not null,
  requested_limit integer not null,
  model_version text not null,
  personalized boolean not null,
  cold_start boolean not null,
  context_json jsonb not null default '{}'::jsonb,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  constraint playlist_ai_recommendation_requests_request_id_check
    check (char_length(btrim(request_id)) between 1 and 200),
  constraint playlist_ai_recommendation_requests_workspace_id_check
    check (char_length(btrim(workspace_id)) between 1 and 200),
  constraint playlist_ai_recommendation_requests_playlist_id_check
    check (char_length(btrim(playlist_id)) between 1 and 200),
  constraint playlist_ai_recommendation_requests_playlist_name_check
    check (char_length(btrim(playlist_name)) between 1 and 300),
  constraint playlist_ai_recommendation_requests_genre_check
    check (char_length(btrim(genre)) between 1 and 80),
  constraint playlist_ai_recommendation_requests_market_check
    check (market in ('BR', 'GLOBAL', 'BOTH')),
  constraint playlist_ai_recommendation_requests_limit_check
    check (requested_limit between 1 and 100),
  constraint playlist_ai_recommendation_requests_model_version_check
    check (char_length(btrim(model_version)) between 1 and 200),
  constraint playlist_ai_recommendation_requests_context_check
    check (jsonb_typeof(context_json) is not distinct from 'object'),
  constraint playlist_ai_recommendation_requests_schema_check
    check (schema_version = 1),
  unique (request_id, workspace_id)
);

create index playlist_ai_recommendation_requests_workspace_created_idx
  on public.playlist_ai_recommendation_requests (
    workspace_id,
    created_at desc,
    request_id desc
  );

create table public.playlist_ai_recommendation_items (
  request_id text not null,
  workspace_id text not null,
  track_id text not null,
  rank integer not null,
  score double precision not null,
  base_score double precision not null,
  learned_score double precision,
  propensity double precision not null,
  reason_codes_json jsonb not null default '[]'::jsonb,
  features_json jsonb not null,
  candidate_json jsonb not null,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  primary key (request_id, track_id),
  foreign key (request_id, workspace_id)
    references public.playlist_ai_recommendation_requests (
      request_id,
      workspace_id
    )
    on update restrict
    on delete restrict,
  constraint playlist_ai_recommendation_items_workspace_id_check
    check (char_length(btrim(workspace_id)) between 1 and 200),
  constraint playlist_ai_recommendation_items_track_id_check
    check (char_length(btrim(track_id)) between 1 and 200),
  constraint playlist_ai_recommendation_items_rank_check
    check (rank between 1 and 100),
  constraint playlist_ai_recommendation_items_score_check
    check (score between 0 and 100),
  constraint playlist_ai_recommendation_items_base_score_check
    check (base_score between 0 and 100),
  constraint playlist_ai_recommendation_items_learned_score_check
    check (learned_score is null or learned_score between 0 and 100),
  constraint playlist_ai_recommendation_items_propensity_check
    check (propensity > 0 and propensity <= 1),
  constraint playlist_ai_recommendation_items_reasons_check
    check (jsonb_typeof(reason_codes_json) is not distinct from 'array'),
  constraint playlist_ai_recommendation_items_features_check
    check (jsonb_typeof(features_json) is not distinct from 'object'),
  constraint playlist_ai_recommendation_items_candidate_check
    check (jsonb_typeof(candidate_json) is not distinct from 'object'),
  constraint playlist_ai_recommendation_items_schema_check
    check (schema_version = 1),
  unique (request_id, rank),
  unique (request_id, track_id, workspace_id)
);

create index playlist_ai_recommendation_items_workspace_track_idx
  on public.playlist_ai_recommendation_items (
    workspace_id,
    track_id,
    created_at desc
  );

create table public.playlist_ai_feedback_events (
  event_id text primary key,
  workspace_id text not null,
  request_id text not null,
  track_id text not null,
  action text not null,
  target_playlist_id text,
  actor_id text not null,
  actor_role text not null,
  occurred_at timestamptz not null,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  foreign key (request_id, track_id, workspace_id)
    references public.playlist_ai_recommendation_items (
      request_id,
      track_id,
      workspace_id
    )
    on update restrict
    on delete restrict,
  constraint playlist_ai_feedback_events_event_id_check
    check (char_length(btrim(event_id)) between 1 and 200),
  constraint playlist_ai_feedback_events_workspace_id_check
    check (char_length(btrim(workspace_id)) between 1 and 200),
  constraint playlist_ai_feedback_events_action_check
    check (
      action in (
        'save',
        'pin',
        'add',
        'accepted',
        'added',
        'like',
        'kept_7d',
        'kept_30d',
        'ignore',
        'rejected',
        'dislike',
        'removed',
        'removed_early',
        'unsave',
        'unpin',
        'shown',
        'clicked',
        'watch'
      )
    ),
  constraint playlist_ai_feedback_events_target_check
    check (
      target_playlist_id is null
      or char_length(btrim(target_playlist_id)) between 1 and 200
    ),
  constraint playlist_ai_feedback_events_actor_id_check
    check (char_length(btrim(actor_id)) between 1 and 200),
  constraint playlist_ai_feedback_events_actor_role_check
    check (char_length(btrim(actor_role)) between 1 and 80),
  constraint playlist_ai_feedback_events_schema_check
    check (schema_version = 1)
);

create index playlist_ai_feedback_events_workspace_time_idx
  on public.playlist_ai_feedback_events (
    workspace_id,
    created_at desc,
    event_id desc
  );

create index playlist_ai_feedback_events_actor_rate_idx
  on public.playlist_ai_feedback_events (
    workspace_id,
    actor_id,
    created_at desc
  );

create table public.playlist_ai_model_registry (
  workspace_id text not null,
  version text not null,
  kind text not null,
  status text not null,
  artifact_json text not null,
  metrics_json jsonb not null default '{}'::jsonb,
  training_start timestamptz,
  training_end timestamptz,
  schema_version smallint not null default 1,
  created_at timestamptz not null default now(),
  promoted_at timestamptz,
  primary key (workspace_id, version),
  constraint playlist_ai_model_registry_workspace_id_check
    check (char_length(btrim(workspace_id)) between 1 and 200),
  constraint playlist_ai_model_registry_version_check
    check (char_length(btrim(version)) between 1 and 200),
  constraint playlist_ai_model_registry_kind_check
    check (kind in ('baseline', 'logistic')),
  constraint playlist_ai_model_registry_status_check
    check (status in ('candidate', 'active', 'retired', 'rejected')),
  constraint playlist_ai_model_registry_artifact_check
    check (
      char_length(btrim(artifact_json)) between 2 and 1048576
      and left(btrim(artifact_json), 1) = '{'
      and right(btrim(artifact_json), 1) = '}'
      and jsonb_typeof(artifact_json::jsonb) is not distinct from 'object'
    ),
  constraint playlist_ai_model_registry_metrics_check
    check (jsonb_typeof(metrics_json) is not distinct from 'object'),
  constraint playlist_ai_model_registry_window_check
    check (
      training_start is null
      or training_end is null
      or training_end >= training_start
    ),
  constraint playlist_ai_model_registry_promotion_check
    check (
      (status = 'active' and promoted_at is not null)
      or status <> 'active'
    ),
  constraint playlist_ai_model_registry_schema_check
    check (schema_version = 1)
);

create unique index playlist_ai_model_registry_one_active_idx
  on public.playlist_ai_model_registry (workspace_id)
  where status = 'active';

create index playlist_ai_model_registry_workspace_created_idx
  on public.playlist_ai_model_registry (
    workspace_id,
    created_at desc,
    version desc
  );

create table public.playlist_ai_maintenance_runs (
  run_id text primary key,
  workspace_id text not null,
  trigger_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  examples_count integer not null default 0,
  candidate_version text,
  promoted boolean not null default false,
  guardrails_json jsonb not null default '{}'::jsonb,
  metrics_json jsonb not null default '{}'::jsonb,
  error_message text,
  schema_version smallint not null default 1,
  constraint playlist_ai_maintenance_runs_run_id_check
    check (char_length(btrim(run_id)) between 1 and 200),
  constraint playlist_ai_maintenance_runs_workspace_id_check
    check (char_length(btrim(workspace_id)) between 1 and 200),
  constraint playlist_ai_maintenance_runs_trigger_check
    check (char_length(btrim(trigger_name)) between 1 and 80),
  constraint playlist_ai_maintenance_runs_status_check
    check (status in ('running', 'completed', 'skipped', 'failed')),
  constraint playlist_ai_maintenance_runs_examples_check
    check (examples_count >= 0),
  constraint playlist_ai_maintenance_runs_candidate_check
    check (
      candidate_version is null
      or char_length(btrim(candidate_version)) between 1 and 200
    ),
  constraint playlist_ai_maintenance_runs_promotion_check
    check (not promoted or candidate_version is not null),
  constraint playlist_ai_maintenance_runs_guardrails_check
    check (jsonb_typeof(guardrails_json) is not distinct from 'object'),
  constraint playlist_ai_maintenance_runs_metrics_check
    check (jsonb_typeof(metrics_json) is not distinct from 'object'),
  constraint playlist_ai_maintenance_runs_error_check
    check (error_message is null or char_length(error_message) <= 4000),
  constraint playlist_ai_maintenance_runs_timeline_check
    check (finished_at is null or finished_at >= started_at),
  constraint playlist_ai_maintenance_runs_settlement_check
    check (
      (status = 'running' and finished_at is null)
      or (status <> 'running' and finished_at is not null)
    ),
  constraint playlist_ai_maintenance_runs_schema_check
    check (schema_version = 1)
);

create unique index playlist_ai_maintenance_runs_one_running_idx
  on public.playlist_ai_maintenance_runs (workspace_id)
  where status = 'running';

create index playlist_ai_maintenance_runs_workspace_started_idx
  on public.playlist_ai_maintenance_runs (
    workspace_id,
    started_at desc,
    run_id desc
  );

create or replace function private.playlist_ai_reject_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only and immutable.', tg_table_name;
end
$function$;

revoke all on function private.playlist_ai_reject_immutable_mutation()
  from public, anon, authenticated, service_role;

create trigger playlist_ai_recommendation_requests_immutable
before update or delete on public.playlist_ai_recommendation_requests
for each row execute function private.playlist_ai_reject_immutable_mutation();

create trigger playlist_ai_recommendation_items_immutable
before update or delete on public.playlist_ai_recommendation_items
for each row execute function private.playlist_ai_reject_immutable_mutation();

create trigger playlist_ai_feedback_events_immutable
before update or delete on public.playlist_ai_feedback_events
for each row execute function private.playlist_ai_reject_immutable_mutation();

create or replace function private.playlist_ai_guard_model_transition()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.version is distinct from old.version
    or new.kind is distinct from old.kind
    or new.artifact_json is distinct from old.artifact_json
    or new.metrics_json is distinct from old.metrics_json
    or new.training_start is distinct from old.training_start
    or new.training_end is distinct from old.training_end
    or new.created_at is distinct from old.created_at
    or new.schema_version is distinct from old.schema_version
  then
    raise exception 'Playlist AI model identity and artifact are immutable.';
  end if;

  if new.status is not distinct from old.status
    and new.promoted_at is not distinct from old.promoted_at
  then
    return new;
  end if;

  if old.status = 'candidate'
    and new.status = 'rejected'
    and new.promoted_at is null
  then
    return new;
  end if;

  if old.status = 'candidate'
    and new.status = 'active'
    and new.promoted_at is not null
  then
    return new;
  end if;

  if old.status = 'active'
    and new.status = 'retired'
    and new.promoted_at is not distinct from old.promoted_at
  then
    return new;
  end if;

  if old.status = 'retired'
    and old.kind = 'baseline'
    and old.version = 'baseline-v1'
    and new.status = 'active'
    and new.promoted_at is not null
  then
    return new;
  end if;

  raise exception 'Invalid Playlist AI model transition: % -> %.',
    old.status,
    new.status;
end
$function$;

revoke all on function private.playlist_ai_guard_model_transition()
  from public, anon, authenticated, service_role;

create trigger playlist_ai_model_registry_guard_transition
before update on public.playlist_ai_model_registry
for each row execute function private.playlist_ai_guard_model_transition();

create or replace function private.playlist_ai_guard_maintenance_transition()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.run_id is distinct from old.run_id
    or new.workspace_id is distinct from old.workspace_id
    or new.trigger_name is distinct from old.trigger_name
    or new.started_at is distinct from old.started_at
    or new.schema_version is distinct from old.schema_version
  then
    raise exception 'Playlist AI maintenance identity is immutable.';
  end if;

  if old.status <> 'running' then
    raise exception 'Completed Playlist AI maintenance runs are immutable.';
  end if;

  if new.status not in ('completed', 'skipped', 'failed')
    or new.finished_at is null
  then
    raise exception 'Maintenance must settle running -> completed, skipped or failed.';
  end if;

  if new.status = 'failed' and nullif(btrim(new.error_message), '') is null then
    raise exception 'Failed maintenance requires an error_message.';
  end if;

  return new;
end
$function$;

revoke all on function private.playlist_ai_guard_maintenance_transition()
  from public, anon, authenticated, service_role;

create trigger playlist_ai_maintenance_runs_guard_transition
before update on public.playlist_ai_maintenance_runs
for each row execute function private.playlist_ai_guard_maintenance_transition();

create trigger playlist_ai_maintenance_runs_no_delete
before delete on public.playlist_ai_maintenance_runs
for each row execute function private.playlist_ai_reject_immutable_mutation();

alter table public.playlist_ai_recommendation_requests enable row level security;
alter table public.playlist_ai_recommendation_requests force row level security;
alter table public.playlist_ai_recommendation_items enable row level security;
alter table public.playlist_ai_recommendation_items force row level security;
alter table public.playlist_ai_feedback_events enable row level security;
alter table public.playlist_ai_feedback_events force row level security;
alter table public.playlist_ai_model_registry enable row level security;
alter table public.playlist_ai_model_registry force row level security;
alter table public.playlist_ai_maintenance_runs enable row level security;
alter table public.playlist_ai_maintenance_runs force row level security;

revoke all on public.playlist_ai_recommendation_requests
  from public, anon, authenticated, service_role;
revoke all on public.playlist_ai_recommendation_items
  from public, anon, authenticated, service_role;
revoke all on public.playlist_ai_feedback_events
  from public, anon, authenticated, service_role;
revoke all on public.playlist_ai_model_registry
  from public, anon, authenticated, service_role;
revoke all on public.playlist_ai_maintenance_runs
  from public, anon, authenticated, service_role;

grant select on public.playlist_ai_recommendation_requests to service_role;
grant select on public.playlist_ai_recommendation_items to service_role;
grant select on public.playlist_ai_model_registry to service_role;
grant insert (
  workspace_id,
  version,
  kind,
  status,
  artifact_json,
  metrics_json,
  training_start,
  training_end
) on public.playlist_ai_model_registry to service_role;
grant update (status) on public.playlist_ai_model_registry to service_role;
grant select on public.playlist_ai_maintenance_runs to service_role;
grant update (
  status,
  finished_at,
  examples_count,
  candidate_version,
  promoted,
  guardrails_json,
  metrics_json,
  error_message
) on public.playlist_ai_maintenance_runs to service_role;

create or replace function public.playlist_ai_agent_schema_version()
returns integer
language sql
immutable
security definer
set search_path = ''
as $function$
  select 1;
$function$;

revoke all on function public.playlist_ai_agent_schema_version()
  from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_agent_schema_version()
  to service_role;

comment on function public.playlist_ai_agent_schema_version() is
  'Returns the deployed Playlists IA persistence contract version (currently 1).';

create or replace function public.playlist_ai_ensure_baseline(
  p_workspace_id text
)
returns setof public.playlist_ai_model_registry
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_workspace_id text := nullif(btrim(p_workspace_id), '');
  v_model public.playlist_ai_model_registry;
begin
  if v_workspace_id is null or char_length(v_workspace_id) > 200 then
    raise exception 'workspace_id must contain between 1 and 200 characters.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('playlist-ai-model:' || v_workspace_id, 0)
  );

  select model.*
  into v_model
  from public.playlist_ai_model_registry as model
  where model.workspace_id = v_workspace_id
    and model.status = 'active'
  order by model.promoted_at desc nulls last, model.created_at desc
  limit 1
  for update;

  if v_model.workspace_id is null then
    insert into public.playlist_ai_model_registry (
      workspace_id,
      version,
      kind,
      status,
      artifact_json,
      metrics_json,
      promoted_at
    )
    values (
      v_workspace_id,
      'baseline-v1',
      'baseline',
      'active',
      '{}',
      '{}'::jsonb,
      now()
    )
    on conflict (workspace_id, version) do nothing;

    select model.*
    into v_model
    from public.playlist_ai_model_registry as model
    where model.workspace_id = v_workspace_id
      and model.status = 'active'
    order by model.promoted_at desc nulls last, model.created_at desc
    limit 1
    for update;
  end if;

  if v_model.workspace_id is null then
    update public.playlist_ai_model_registry as model
    set
      status = 'active',
      promoted_at = now()
    where model.workspace_id = v_workspace_id
      and model.version = 'baseline-v1'
      and model.kind = 'baseline'
      and model.status = 'retired'
    returning model.* into v_model;
  end if;

  if v_model.workspace_id is null then
    raise exception 'Could not initialize the Playlist AI baseline model.';
  end if;

  return next v_model;
end
$function$;

revoke all on function public.playlist_ai_ensure_baseline(text)
  from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_ensure_baseline(text)
  to service_role;

comment on function public.playlist_ai_ensure_baseline(text) is
  'Atomically returns the active workspace model or creates baseline-v1.';

create or replace function public.playlist_ai_save_impression(
  p_request jsonb,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_id text;
  v_workspace_id text;
  v_playlist_id text;
  v_playlist_name text;
  v_genre text;
  v_market text;
  v_as_of timestamptz;
  v_requested_limit integer;
  v_model_version text;
  v_personalized boolean;
  v_cold_start boolean;
  v_context jsonb;
  v_item_count integer;
  v_distinct_tracks integer;
  v_distinct_ranks integer;
  v_min_rank integer;
  v_max_rank integer;
  v_invalid_items integer;
  v_existing_request jsonb;
  v_incoming_request jsonb;
  v_existing_items jsonb;
  v_incoming_items jsonb;
begin
  if p_request is null
    or jsonb_typeof(p_request) is distinct from 'object'
  then
    raise exception 'p_request must be a JSON object.';
  end if;
  if p_items is null
    or jsonb_typeof(p_items) is distinct from 'array'
  then
    raise exception 'p_items must be a JSON array.';
  end if;

  v_request_id := nullif(btrim(p_request ->> 'request_id'), '');
  v_workspace_id := nullif(btrim(p_request ->> 'workspace_id'), '');
  v_playlist_id := nullif(btrim(p_request ->> 'playlist_id'), '');
  v_playlist_name := nullif(btrim(p_request ->> 'playlist_name'), '');
  v_genre := coalesce(nullif(btrim(p_request ->> 'genre'), ''), 'desconhecido');
  v_market := upper(nullif(btrim(p_request ->> 'market'), ''));
  v_as_of := (p_request ->> 'as_of')::timestamptz;
  v_requested_limit := (p_request ->> 'requested_limit')::integer;
  v_model_version := nullif(btrim(p_request ->> 'model_version'), '');
  v_personalized := (p_request ->> 'personalized')::boolean;
  v_cold_start := (p_request ->> 'cold_start')::boolean;
  v_context := coalesce(p_request -> 'context_json', '{}'::jsonb);

  if v_request_id is null or char_length(v_request_id) > 200
    or v_workspace_id is null or char_length(v_workspace_id) > 200
    or v_playlist_id is null or char_length(v_playlist_id) > 200
    or v_playlist_name is null or char_length(v_playlist_name) > 300
    or char_length(v_genre) > 80
    or v_model_version is null or char_length(v_model_version) > 200
    or v_market is null or v_market not in ('BR', 'GLOBAL', 'BOTH')
    or v_as_of is null
    or v_requested_limit is null
    or v_requested_limit < 1 or v_requested_limit > 100
    or v_personalized is null
    or v_cold_start is null
    or jsonb_typeof(v_context) is distinct from 'object'
  then
    raise exception 'Invalid Playlist AI impression request.';
  end if;

  select
    count(*)::integer,
    count(distinct btrim(item.track_id))::integer,
    count(distinct item.rank)::integer,
    min(item.rank)::integer,
    max(item.rank)::integer,
    count(*) filter (
      where nullif(btrim(item.request_id), '') is distinct from v_request_id
        or nullif(btrim(item.workspace_id), '') is distinct from v_workspace_id
        or nullif(btrim(item.track_id), '') is null
        or char_length(btrim(item.track_id)) > 200
        or item.rank is null
        or item.score is null or item.score < 0 or item.score > 100
        or item.base_score is null
        or item.base_score < 0 or item.base_score > 100
        or item.learned_score < 0 or item.learned_score > 100
        or item.propensity is null
        or item.propensity <= 0 or item.propensity > 1
        or item.reason_codes_json is null
        or jsonb_typeof(item.reason_codes_json) is distinct from 'array'
        or item.features_json is null
        or jsonb_typeof(item.features_json) is distinct from 'object'
        or item.candidate_json is null
        or jsonb_typeof(item.candidate_json) is distinct from 'object'
    )::integer
  into
    v_item_count,
    v_distinct_tracks,
    v_distinct_ranks,
    v_min_rank,
    v_max_rank,
    v_invalid_items
  from jsonb_to_recordset(p_items) as item(
    request_id text,
    workspace_id text,
    track_id text,
    rank integer,
    score double precision,
    base_score double precision,
    learned_score double precision,
    propensity double precision,
    reason_codes_json jsonb,
    features_json jsonb,
    candidate_json jsonb
  );

  if v_item_count < 1
    or v_item_count > v_requested_limit
    or v_distinct_tracks <> v_item_count
    or v_distinct_ranks <> v_item_count
    or v_min_rank <> 1
    or v_max_rank <> v_item_count
    or v_invalid_items <> 0
  then
    raise exception 'Invalid or incomplete Playlist AI impression items.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'request_id', btrim(item.request_id),
        'workspace_id', btrim(item.workspace_id),
        'track_id', btrim(item.track_id),
        'rank', item.rank,
        'score', item.score,
        'base_score', item.base_score,
        'learned_score', item.learned_score,
        'propensity', item.propensity,
        'reason_codes_json', item.reason_codes_json,
        'features_json', item.features_json,
        'candidate_json', item.candidate_json
      )
      order by btrim(item.track_id)
    ),
    '[]'::jsonb
  )
  into v_incoming_items
  from jsonb_to_recordset(p_items) as item(
    request_id text,
    workspace_id text,
    track_id text,
    rank integer,
    score double precision,
    base_score double precision,
    learned_score double precision,
    propensity double precision,
    reason_codes_json jsonb,
    features_json jsonb,
    candidate_json jsonb
  );

  v_incoming_request := jsonb_build_object(
    'request_id', v_request_id,
    'workspace_id', v_workspace_id,
    'playlist_id', v_playlist_id,
    'playlist_name', v_playlist_name,
    'genre', v_genre,
    'market', v_market,
    'as_of', to_jsonb(v_as_of),
    'requested_limit', v_requested_limit,
    'model_version', v_model_version,
    'personalized', v_personalized,
    'cold_start', v_cold_start,
    'context_json', v_context
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('playlist-ai-impression:' || v_request_id, 0)
  );

  select jsonb_build_object(
    'request_id', request.request_id,
    'workspace_id', request.workspace_id,
    'playlist_id', request.playlist_id,
    'playlist_name', request.playlist_name,
    'genre', request.genre,
    'market', request.market,
    'as_of', to_jsonb(request.as_of),
    'requested_limit', request.requested_limit,
    'model_version', request.model_version,
    'personalized', request.personalized,
    'cold_start', request.cold_start,
    'context_json', request.context_json
  )
  into v_existing_request
  from public.playlist_ai_recommendation_requests as request
  where request.request_id = v_request_id;

  if v_existing_request is not null then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'request_id', item.request_id,
          'workspace_id', item.workspace_id,
          'track_id', item.track_id,
          'rank', item.rank,
          'score', item.score,
          'base_score', item.base_score,
          'learned_score', item.learned_score,
          'propensity', item.propensity,
          'reason_codes_json', item.reason_codes_json,
          'features_json', item.features_json,
          'candidate_json', item.candidate_json
        )
        order by item.track_id
      ),
      '[]'::jsonb
    )
    into v_existing_items
    from public.playlist_ai_recommendation_items as item
    where item.request_id = v_request_id;

    if v_existing_request = v_incoming_request
      and v_existing_items = v_incoming_items
    then
      return;
    end if;

    raise exception 'request_id already exists with different impression content.';
  end if;

  insert into public.playlist_ai_recommendation_requests (
    request_id,
    workspace_id,
    playlist_id,
    playlist_name,
    genre,
    market,
    as_of,
    requested_limit,
    model_version,
    personalized,
    cold_start,
    context_json
  )
  values (
    v_request_id,
    v_workspace_id,
    v_playlist_id,
    v_playlist_name,
    v_genre,
    v_market,
    v_as_of,
    v_requested_limit,
    v_model_version,
    v_personalized,
    v_cold_start,
    v_context
  );

  insert into public.playlist_ai_recommendation_items (
    request_id,
    workspace_id,
    track_id,
    rank,
    score,
    base_score,
    learned_score,
    propensity,
    reason_codes_json,
    features_json,
    candidate_json
  )
  select
    btrim(item.request_id),
    btrim(item.workspace_id),
    btrim(item.track_id),
    item.rank,
    item.score,
    item.base_score,
    item.learned_score,
    item.propensity,
    item.reason_codes_json,
    item.features_json,
    item.candidate_json
  from jsonb_to_recordset(p_items) as item(
    request_id text,
    workspace_id text,
    track_id text,
    rank integer,
    score double precision,
    base_score double precision,
    learned_score double precision,
    propensity double precision,
    reason_codes_json jsonb,
    features_json jsonb,
    candidate_json jsonb
  )
  order by item.rank;
end
$function$;

revoke all on function public.playlist_ai_save_impression(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_save_impression(jsonb, jsonb)
  to service_role;

comment on function public.playlist_ai_save_impression(jsonb, jsonb) is
  'Atomically freezes one ranked request and its displayed items; exact retries are idempotent.';

create or replace function public.playlist_ai_record_feedback(
  p_workspace_id text,
  p_request_id text,
  p_track_id text,
  p_action text,
  p_event_id text,
  p_target_playlist_id text,
  p_actor_id text,
  p_actor_role text,
  p_occurred_at timestamptz,
  p_max_actor_events_per_hour integer
)
returns table (
  event_id text,
  created boolean,
  action text,
  occurred_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_workspace_id text := nullif(btrim(p_workspace_id), '');
  v_request_id text := nullif(btrim(p_request_id), '');
  v_track_id text := nullif(btrim(p_track_id), '');
  v_action text := lower(nullif(btrim(p_action), ''));
  v_event_id text := nullif(btrim(p_event_id), '');
  v_target_playlist_id text := nullif(btrim(p_target_playlist_id), '');
  v_actor_id text := nullif(btrim(p_actor_id), '');
  v_actor_role text := lower(nullif(btrim(p_actor_role), ''));
  v_existing public.playlist_ai_feedback_events;
  v_impression_created_at timestamptz;
  v_actor_events integer;
begin
  if v_workspace_id is null or char_length(v_workspace_id) > 200
    or v_request_id is null or char_length(v_request_id) > 200
    or v_track_id is null or char_length(v_track_id) > 200
    or v_event_id is null or char_length(v_event_id) > 200
    or v_actor_id is null or char_length(v_actor_id) > 200
    or v_actor_role is null or char_length(v_actor_role) > 80
    or p_occurred_at is null
    or p_max_actor_events_per_hour is null
    or p_max_actor_events_per_hour < 1
    or p_max_actor_events_per_hour > 100000
  then
    raise exception 'Invalid Playlist AI feedback payload.';
  end if;

  if v_action not in (
    'save', 'pin', 'add', 'accepted', 'added', 'like',
    'kept_7d', 'kept_30d', 'ignore', 'rejected', 'dislike',
    'removed', 'removed_early', 'unsave', 'unpin',
    'shown', 'clicked', 'watch'
  ) then
    raise exception 'Invalid Playlist AI feedback action.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('playlist-ai-event:' || v_event_id, 0)
  );

  select feedback.*
  into v_existing
  from public.playlist_ai_feedback_events as feedback
  where feedback.event_id = v_event_id;

  if v_existing.event_id is not null then
    if v_existing.workspace_id = v_workspace_id
      and v_existing.request_id = v_request_id
      and v_existing.track_id = v_track_id
      and v_existing.action = v_action
      and v_existing.target_playlist_id is not distinct from v_target_playlist_id
      and v_existing.actor_id = v_actor_id
      and v_existing.actor_role = v_actor_role
    then
      return query
      select
        v_existing.event_id,
        false,
        v_existing.action,
        v_existing.occurred_at;
      return;
    end if;

    raise exception 'event_id already exists for another feedback event.';
  end if;

  select request.created_at
  into v_impression_created_at
  from public.playlist_ai_recommendation_items as item
  join public.playlist_ai_recommendation_requests as request
    on request.request_id = item.request_id
   and request.workspace_id = item.workspace_id
  where item.workspace_id = v_workspace_id
    and item.request_id = v_request_id
    and item.track_id = v_track_id;

  if v_impression_created_at is null then
    raise exception using
      errcode = 'P0002',
      message = 'recommendation item not found in this workspace';
  end if;

  if p_occurred_at < v_impression_created_at - interval '5 minutes' then
    raise exception 'occurred_at cannot be earlier than the impression.';
  end if;
  if p_occurred_at > now() + interval '5 minutes' then
    raise exception 'occurred_at cannot be more than five minutes in the future.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'playlist-ai-actor:' || v_workspace_id || ':' || v_actor_id,
      0
    )
  );

  select count(*)::integer
  into v_actor_events
  from public.playlist_ai_feedback_events as feedback
  where feedback.workspace_id = v_workspace_id
    and feedback.actor_id = v_actor_id
    and feedback.created_at >= now() - interval '1 hour';

  if v_actor_events >= p_max_actor_events_per_hour then
    raise exception 'feedback rate limit exceeded for this actor.';
  end if;

  insert into public.playlist_ai_feedback_events (
    event_id,
    workspace_id,
    request_id,
    track_id,
    action,
    target_playlist_id,
    actor_id,
    actor_role,
    occurred_at
  )
  values (
    v_event_id,
    v_workspace_id,
    v_request_id,
    v_track_id,
    v_action,
    v_target_playlist_id,
    v_actor_id,
    v_actor_role,
    p_occurred_at
  );

  return query select v_event_id, true, v_action, p_occurred_at;
end
$function$;

revoke all on function public.playlist_ai_record_feedback(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  integer
) from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_record_feedback(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  integer
) to service_role;

comment on function public.playlist_ai_record_feedback(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  integer
) is
  'Records one workspace-scoped feedback event with idempotency before the per-actor rate limit.';

create or replace function public.playlist_ai_promote_model(
  p_workspace_id text,
  p_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_workspace_id text := nullif(btrim(p_workspace_id), '');
  v_version text := nullif(btrim(p_version), '');
  v_candidate public.playlist_ai_model_registry;
begin
  if v_workspace_id is null or char_length(v_workspace_id) > 200
    or v_version is null or char_length(v_version) > 200
  then
    raise exception 'workspace_id and version are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('playlist-ai-model:' || v_workspace_id, 0)
  );

  select model.*
  into v_candidate
  from public.playlist_ai_model_registry as model
  where model.workspace_id = v_workspace_id
    and model.version = v_version
    and model.kind = 'logistic'
    and model.status = 'candidate'
  for update;

  if v_candidate.workspace_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'candidate model not found';
  end if;

  update public.playlist_ai_model_registry as model
  set status = 'retired'
  where model.workspace_id = v_workspace_id
    and model.status = 'active';

  update public.playlist_ai_model_registry as model
  set
    status = 'active',
    promoted_at = now()
  where model.workspace_id = v_workspace_id
    and model.version = v_version
    and model.status = 'candidate';
end
$function$;

revoke all on function public.playlist_ai_promote_model(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_promote_model(text, text)
  to service_role;

comment on function public.playlist_ai_promote_model(text, text) is
  'Atomically retires the active workspace champion and promotes one logistic candidate.';

create or replace function public.playlist_ai_feedback_rows(
  p_workspace_id text,
  p_page_size integer,
  p_before_created_at timestamptz default null,
  p_before_event_id text default null
)
returns table (
  event_id text,
  request_id text,
  track_id text,
  action text,
  target_playlist_id text,
  occurred_at timestamptz,
  server_created_at timestamptz,
  impression_playlist_id text,
  features_json jsonb,
  base_score double precision,
  propensity double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_workspace_id text := nullif(btrim(p_workspace_id), '');
begin
  if v_workspace_id is null or char_length(v_workspace_id) > 200 then
    raise exception 'workspace_id must contain between 1 and 200 characters.';
  end if;
  if p_page_size is null or p_page_size < 1 or p_page_size > 1000 then
    raise exception 'page_size must be between 1 and 1000.';
  end if;
  if (p_before_created_at is null) <> (p_before_event_id is null) then
    raise exception 'Both feedback keyset cursor fields must be provided together.';
  end if;

  return query
  select
    feedback.event_id,
    feedback.request_id,
    feedback.track_id,
    feedback.action,
    feedback.target_playlist_id,
    feedback.occurred_at,
    feedback.created_at,
    request.playlist_id,
    item.features_json,
    item.base_score,
    item.propensity
  from public.playlist_ai_feedback_events as feedback
  join public.playlist_ai_recommendation_items as item
    on item.request_id = feedback.request_id
   and item.track_id = feedback.track_id
   and item.workspace_id = feedback.workspace_id
  join public.playlist_ai_recommendation_requests as request
    on request.request_id = feedback.request_id
   and request.workspace_id = feedback.workspace_id
  where feedback.workspace_id = v_workspace_id
    and (
      p_before_created_at is null
      or (feedback.created_at, feedback.event_id)
        < (p_before_created_at, p_before_event_id)
    )
  order by feedback.created_at desc, feedback.event_id desc
  limit p_page_size;
end
$function$;

revoke all on function public.playlist_ai_feedback_rows(
  text,
  integer,
  timestamptz,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_feedback_rows(
  text,
  integer,
  timestamptz,
  text
) to service_role;

comment on function public.playlist_ai_feedback_rows(
  text,
  integer,
  timestamptz,
  text
) is
  'Returns a bounded newest-first training page using the immutable server-created keyset.';

create or replace function public.playlist_ai_list_workspaces(
  p_limit integer
)
returns table (workspace_id text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'limit must be between 1 and 1000.';
  end if;

  return query
  select request.workspace_id
  from public.playlist_ai_recommendation_requests as request
  group by request.workspace_id
  order by max(request.created_at) desc, request.workspace_id
  limit p_limit;
end
$function$;

revoke all on function public.playlist_ai_list_workspaces(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_list_workspaces(integer)
  to service_role;

comment on function public.playlist_ai_list_workspaces(integer) is
  'Returns a bounded list of workspaces ordered by their latest frozen impression.';

create or replace function public.playlist_ai_start_maintenance(
  p_run_id text,
  p_workspace_id text,
  p_trigger_name text
)
returns table (run_id text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run_id text := nullif(btrim(p_run_id), '');
  v_workspace_id text := nullif(btrim(p_workspace_id), '');
  v_trigger_name text := nullif(btrim(p_trigger_name), '');
  v_existing public.playlist_ai_maintenance_runs;
  v_conflict boolean;
begin
  if v_run_id is null or char_length(v_run_id) > 200
    or v_workspace_id is null or char_length(v_workspace_id) > 200
    or v_trigger_name is null or char_length(v_trigger_name) > 80
  then
    raise exception 'Invalid Playlist AI maintenance identity.';
  end if;

  -- Serialize every distributed claim so a global run and a workspace run
  -- cannot both pass their conflict checks.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('playlist-ai-maintenance-claim', 0)
  );

  select maintenance.*
  into v_existing
  from public.playlist_ai_maintenance_runs as maintenance
  where maintenance.run_id = v_run_id;

  if v_existing.run_id is not null then
    if v_existing.workspace_id = v_workspace_id
      and v_existing.trigger_name = v_trigger_name
    then
      return query select v_existing.run_id;
      return;
    end if;
    raise exception 'maintenance run_id already belongs to another run.';
  end if;

  -- A running row is a 30-minute lease. Recover abandoned jobs before
  -- checking conflicts; the transition trigger keeps the recovery audited.
  update public.playlist_ai_maintenance_runs as maintenance
  set
    status = 'failed',
    finished_at = now(),
    error_message = 'Maintenance lease expired after 30 minutes.'
  where maintenance.status = 'running'
    and maintenance.started_at <= now() - interval '30 minutes';

  select exists (
    select 1
    from public.playlist_ai_maintenance_runs as maintenance
    where maintenance.status = 'running'
      and (
        (v_workspace_id = '__all__')
        or maintenance.workspace_id = '__all__'
        or maintenance.workspace_id = v_workspace_id
      )
  )
  into v_conflict;

  if v_conflict then
    raise exception 'Playlist AI maintenance is already running for this scope.';
  end if;

  insert into public.playlist_ai_maintenance_runs (
    run_id,
    workspace_id,
    trigger_name,
    status
  )
  values (
    v_run_id,
    v_workspace_id,
    v_trigger_name,
    'running'
  );

  return query select v_run_id;
end
$function$;

revoke all on function public.playlist_ai_start_maintenance(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.playlist_ai_start_maintenance(text, text, text)
  to service_role;

comment on function public.playlist_ai_start_maintenance(text, text, text) is
  'Claims an audited 30-minute maintenance lease and rejects overlapping distributed runs.';

comment on table public.playlist_ai_recommendation_requests is
  'Schema v1 server-only immutable Playlists IA ranking requests.';
comment on table public.playlist_ai_recommendation_items is
  'Schema v1 server-only immutable displayed recommendations and frozen feature snapshots.';
comment on table public.playlist_ai_feedback_events is
  'Schema v1 server-only append-only curator and system feedback audit log.';
comment on table public.playlist_ai_model_registry is
  'Schema v1 server-only candidate/champion registry for workspace-scoped ranking models.';
comment on table public.playlist_ai_maintenance_runs is
  'Schema v1 server-only training maintenance audit log with a distributed 30-minute lease.';
