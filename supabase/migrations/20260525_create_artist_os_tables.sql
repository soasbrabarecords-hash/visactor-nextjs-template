create extension if not exists pgcrypto;

create table if not exists public.artist_os_artists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  stage_name text not null,
  full_name text,
  artist_type text not null default 'artista' check (artist_type in ('artista', 'dj', 'produtor', 'influenciador', 'banda')),
  city text,
  state text,
  country text not null default 'BR',
  email text,
  phone text,
  instagram_url text,
  tiktok_url text,
  youtube_url text,
  spotify_url text,
  apple_music_url text,
  default_fee numeric(14,2),
  default_commission numeric(6,2),
  notes text,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  contract_type text,
  counterparty text not null,
  value numeric(14,2),
  signed_at date,
  due_at date,
  status text not null default 'aguardando' check (status in ('aguardando', 'enviado', 'assinado', 'vencido', 'cancelado')),
  file_url text,
  linked_to_type text,
  linked_to_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_shows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  event_name text not null,
  city text,
  state text,
  country text not null default 'BR',
  venue text,
  event_date date,
  event_time time,
  contractor_name text,
  contractor_phone text,
  fee_value numeric(14,2),
  logistics_included boolean not null default false,
  deposit_value numeric(14,2),
  remaining_value numeric(14,2),
  status text not null default 'lead' check (
    status in (
      'lead',
      'proposta_enviada',
      'negociando',
      'fechado',
      'sinal_pago',
      'em_execucao',
      'realizado',
      'pago_final',
      'cancelado'
    )
  ),
  team_involved text,
  hotel text,
  flights text,
  transport text,
  contract_id uuid references public.artist_os_contracts(id) on delete set null,
  receipt_links text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  contact_name text not null,
  phone text,
  email text,
  city text,
  event_type text,
  desired_date date,
  estimated_budget numeric(14,2),
  lead_source text,
  status text not null default 'frio' check (status in ('frio', 'quente', 'proposta_enviada', 'aguardando_resposta', 'fechado', 'perdido')),
  next_action text,
  next_action_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_brand_deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  brand text not null,
  agency text,
  responsible_contact text,
  campaign_name text,
  negotiated_value numeric(14,2),
  campaign_start date,
  campaign_end date,
  status text not null default 'prospeccao' check (
    status in (
      'prospeccao',
      'proposta_enviada',
      'negociando',
      'aprovado',
      'contrato',
      'producao',
      'publicado',
      'comprovado',
      'pago',
      'finalizado',
      'cancelado'
    )
  ),
  deliverables text,
  published_links text,
  proof_links text,
  advisor_approval boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_brand_deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  brand_deal_id uuid references public.artist_os_brand_deals(id) on delete cascade,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  deliverable_type text not null,
  description text,
  due_at date,
  status text not null default 'pendente',
  published_url text,
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_finance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  transaction_type text not null default 'entrada' check (transaction_type in ('entrada', 'saida')),
  category text,
  description text not null,
  amount numeric(14,2) not null default 0,
  occurred_on date,
  due_date date,
  payment_method text,
  status text not null default 'previsto' check (status in ('previsto', 'recebido', 'pago', 'atrasado', 'cancelado')),
  linked_to_type text,
  linked_to_id uuid,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  assignee text,
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta', 'urgente')),
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'aguardando', 'concluida', 'cancelada')),
  due_at date,
  linked_to_type text,
  linked_to_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  artist_id uuid references public.artist_os_artists(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text,
  linked_to_type text,
  linked_to_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_os_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  default_commission numeric(6,2) not null default 20,
  default_currency text not null default 'BRL',
  roles jsonb not null default '["admin","manager","financeiro","artista","equipe"]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create index if not exists artist_os_artists_workspace_idx on public.artist_os_artists (workspace_id, created_at desc);
create index if not exists artist_os_shows_workspace_date_idx on public.artist_os_shows (workspace_id, event_date);
create index if not exists artist_os_shows_artist_idx on public.artist_os_shows (artist_id);
create index if not exists artist_os_deals_workspace_status_idx on public.artist_os_deals (workspace_id, status);
create index if not exists artist_os_brand_deals_workspace_status_idx on public.artist_os_brand_deals (workspace_id, status);
create index if not exists artist_os_finance_workspace_due_idx on public.artist_os_finance (workspace_id, due_date);
create index if not exists artist_os_contracts_workspace_due_idx on public.artist_os_contracts (workspace_id, due_at);
create index if not exists artist_os_tasks_workspace_due_idx on public.artist_os_tasks (workspace_id, due_at);

create or replace function public.artist_os_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'artist_os_artists',
    'artist_os_shows',
    'artist_os_deals',
    'artist_os_brand_deals',
    'artist_os_brand_deliverables',
    'artist_os_finance',
    'artist_os_contracts',
    'artist_os_tasks',
    'artist_os_files',
    'artist_os_settings'
  ]
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function public.artist_os_touch_updated_at()',
      table_name,
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create or replace function public.artist_os_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      target_workspace_id is null
      or exists (
        select 1
        from public.workspace_memberships memberships
        where memberships.workspace_id = target_workspace_id
          and memberships.user_id = auth.uid()
      )
    );
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'artist_os_artists',
    'artist_os_shows',
    'artist_os_deals',
    'artist_os_brand_deals',
    'artist_os_brand_deliverables',
    'artist_os_finance',
    'artist_os_contracts',
    'artist_os_tasks',
    'artist_os_files',
    'artist_os_settings'
  ]
  loop
    execute format('drop policy if exists "artist os members can read" on public.%I', table_name);
    execute format('drop policy if exists "artist os members can insert" on public.%I', table_name);
    execute format('drop policy if exists "artist os members can update" on public.%I', table_name);
    execute format('drop policy if exists "artist os members can delete" on public.%I', table_name);

    execute format(
      'create policy "artist os members can read" on public.%I for select to authenticated using (public.artist_os_is_workspace_member(workspace_id))',
      table_name
    );
    execute format(
      'create policy "artist os members can insert" on public.%I for insert to authenticated with check (public.artist_os_is_workspace_member(workspace_id))',
      table_name
    );
    execute format(
      'create policy "artist os members can update" on public.%I for update to authenticated using (public.artist_os_is_workspace_member(workspace_id)) with check (public.artist_os_is_workspace_member(workspace_id))',
      table_name
    );
    execute format(
      'create policy "artist os members can delete" on public.%I for delete to authenticated using (public.artist_os_is_workspace_member(workspace_id))',
      table_name
    );
  end loop;
end $$;

