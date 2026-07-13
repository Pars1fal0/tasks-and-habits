create table if not exists public.rhythm_states (
  user_key text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  state jsonb not null,
  ui_state jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  client_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_rhythm_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rhythm_states_updated_at on public.rhythm_states;
create trigger rhythm_states_updated_at
before update on public.rhythm_states
for each row
execute function public.set_rhythm_states_updated_at();

create index if not exists rhythm_states_client_updated_at_idx
on public.rhythm_states (client_updated_at desc);

alter table public.rhythm_states
add column if not exists user_id uuid references auth.users (id) on delete cascade;

drop index if exists public.rhythm_states_user_id_idx;
create unique index rhythm_states_user_id_idx
on public.rhythm_states (user_id);

alter table public.rhythm_states enable row level security;

drop policy if exists "rhythm_states_select_own_key" on public.rhythm_states;
create policy "rhythm_states_select_own_key"
on public.rhythm_states
for select
to anon
using (
  user_id is null and
  user_key = (current_setting('request.headers', true)::json ->> 'x-rhythm-user-key')
);

drop policy if exists "rhythm_states_insert_own_key" on public.rhythm_states;
create policy "rhythm_states_insert_own_key"
on public.rhythm_states
for insert
to anon
with check (
  user_id is null and
  user_key = (current_setting('request.headers', true)::json ->> 'x-rhythm-user-key')
);

drop policy if exists "rhythm_states_select_authenticated" on public.rhythm_states;
create policy "rhythm_states_select_authenticated"
on public.rhythm_states
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "rhythm_states_insert_authenticated" on public.rhythm_states;
create policy "rhythm_states_insert_authenticated"
on public.rhythm_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "rhythm_states_update_authenticated" on public.rhythm_states;
create policy "rhythm_states_update_authenticated"
on public.rhythm_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "rhythm_states_update_own_key" on public.rhythm_states;
create policy "rhythm_states_update_own_key"
on public.rhythm_states
for update
to anon
using (
  user_id is null and
  user_key = (current_setting('request.headers', true)::json ->> 'x-rhythm-user-key')
)
with check (
  user_id is null and
  user_key = (current_setting('request.headers', true)::json ->> 'x-rhythm-user-key')
);
