create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'owner')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal')),
  symbol text,
  transaction_date date not null default current_date,
  shares numeric,
  price numeric,
  amount numeric,
  fees numeric not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null default 'Default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);

create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);
create index if not exists transactions_workspace_date_idx on public.transactions (workspace_id, transaction_date desc);
create index if not exists transactions_workspace_symbol_idx on public.transactions (workspace_id, symbol);
create index if not exists watchlists_workspace_id_idx on public.watchlists (workspace_id);
create index if not exists watchlist_items_watchlist_id_idx on public.watchlist_items (watchlist_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.transactions enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = (select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists workspaces_member_read on public.workspaces;
create policy workspaces_member_read on public.workspaces for select using (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.workspace_members member
    where member.workspace_id = workspaces.id and member.user_id = (select auth.uid())
  )
);
drop policy if exists workspaces_owner_insert on public.workspaces;
create policy workspaces_owner_insert on public.workspaces for insert with check (owner_id = (select auth.uid()));
drop policy if exists workspaces_owner_update on public.workspaces;
create policy workspaces_owner_update on public.workspaces for update using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists workspaces_owner_delete on public.workspaces;
create policy workspaces_owner_delete on public.workspaces for delete using (owner_id = (select auth.uid()));

drop policy if exists workspace_members_member_read on public.workspace_members;
create policy workspace_members_member_read on public.workspace_members for select using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.workspaces workspace
    where workspace.id = workspace_members.workspace_id and workspace.owner_id = (select auth.uid())
  )
);
drop policy if exists workspace_members_owner_insert on public.workspace_members;
create policy workspace_members_owner_insert on public.workspace_members for insert with check (exists (
  select 1 from public.workspaces workspace
  where workspace.id = workspace_members.workspace_id and workspace.owner_id = (select auth.uid())
));
drop policy if exists workspace_members_owner_update on public.workspace_members;
create policy workspace_members_owner_update on public.workspace_members for update using (exists (
  select 1 from public.workspaces workspace
  where workspace.id = workspace_members.workspace_id and workspace.owner_id = (select auth.uid())
)) with check (exists (
  select 1 from public.workspaces workspace
  where workspace.id = workspace_members.workspace_id and workspace.owner_id = (select auth.uid())
));
drop policy if exists workspace_members_owner_delete on public.workspace_members;
create policy workspace_members_owner_delete on public.workspace_members for delete using (exists (
  select 1 from public.workspaces workspace
  where workspace.id = workspace_members.workspace_id and workspace.owner_id = (select auth.uid())
));

drop policy if exists transactions_member_read on public.transactions;
create policy transactions_member_read on public.transactions for select using (exists (
  select 1 from public.workspace_members member
  where member.workspace_id = transactions.workspace_id and member.user_id = (select auth.uid())
));
drop policy if exists transactions_member_insert on public.transactions;
create policy transactions_member_insert on public.transactions for insert with check (user_id = (select auth.uid()) and exists (
  select 1 from public.workspace_members member
  where member.workspace_id = transactions.workspace_id and member.user_id = (select auth.uid())
));
drop policy if exists transactions_member_update on public.transactions;
create policy transactions_member_update on public.transactions for update using (exists (
  select 1 from public.workspace_members member
  where member.workspace_id = transactions.workspace_id and member.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.workspace_members member
  where member.workspace_id = transactions.workspace_id and member.user_id = (select auth.uid())
));
drop policy if exists transactions_member_delete on public.transactions;
create policy transactions_member_delete on public.transactions for delete using (exists (
  select 1 from public.workspace_members member
  where member.workspace_id = transactions.workspace_id and member.user_id = (select auth.uid())
));

drop policy if exists watchlists_member_read on public.watchlists;
create policy watchlists_member_read on public.watchlists for select using (exists (
  select 1 from public.workspace_members member
  where member.workspace_id = watchlists.workspace_id and member.user_id = (select auth.uid())
));
drop policy if exists watchlists_member_write on public.watchlists;
create policy watchlists_member_write on public.watchlists for all using (exists (
  select 1 from public.workspace_members member
  where member.workspace_id = watchlists.workspace_id and member.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.workspace_members member
  where member.workspace_id = watchlists.workspace_id and member.user_id = (select auth.uid())
));

drop policy if exists watchlist_items_member_read on public.watchlist_items;
create policy watchlist_items_member_read on public.watchlist_items for select using (exists (
  select 1 from public.watchlists list
  join public.workspace_members member on member.workspace_id = list.workspace_id
  where list.id = watchlist_items.watchlist_id and member.user_id = (select auth.uid())
));
drop policy if exists watchlist_items_member_write on public.watchlist_items;
create policy watchlist_items_member_write on public.watchlist_items for all using (exists (
  select 1 from public.watchlists list
  join public.workspace_members member on member.workspace_id = list.workspace_id
  where list.id = watchlist_items.watchlist_id and member.user_id = (select auth.uid())
)) with check (exists (
  select 1 from public.watchlists list
  join public.workspace_members member on member.workspace_id = list.workspace_id
  where list.id = watchlist_items.watchlist_id and member.user_id = (select auth.uid())
));