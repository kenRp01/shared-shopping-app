create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  planned_date date,
  visibility text not null check (visibility in ('private', 'shared', 'public_link')),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  public_token text unique,
  daily_reminder_enabled boolean not null default true,
  daily_reminder_hour text not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  invited_by_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (list_id, user_id)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  title text not null,
  quantity text not null default '1',
  note text not null default '',
  status text not null check (status in ('pending', 'purchased')) default 'pending',
  scope text not null check (scope in ('shared', 'personal')) default 'shared',
  due_date date,
  due_time text,
  remind_on date,
  reminder_enabled boolean not null default true,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  updated_by_user_id uuid not null references public.profiles(id) on delete cascade,
  purchased_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  delivery_date date not null,
  status text not null check (status in ('sent', 'skipped')),
  sent_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, delivery_date)
);

alter table public.shopping_lists
  add column if not exists planned_date date,
  add column if not exists public_token text,
  add column if not exists daily_reminder_enabled boolean not null default true,
  add column if not exists daily_reminder_hour text not null default '08:00',
  add column if not exists updated_at timestamptz not null default now();

alter table public.shopping_items
  add column if not exists scope text not null default 'shared',
  add column if not exists due_date date,
  add column if not exists due_time text,
  add column if not exists remind_on date,
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.shopping_items
  drop constraint if exists shopping_items_scope_check;

alter table public.shopping_items
  add constraint shopping_items_scope_check
  check (scope in ('shared', 'personal'));

create index if not exists shopping_lists_owner_user_id_idx
  on public.shopping_lists(owner_user_id);

create index if not exists shopping_list_members_list_id_idx
  on public.shopping_list_members(list_id);

create index if not exists shopping_list_members_user_id_idx
  on public.shopping_list_members(user_id);

create index if not exists shopping_items_list_id_idx
  on public.shopping_items(list_id);

create index if not exists shopping_items_created_by_user_id_idx
  on public.shopping_items(created_by_user_id);

create index if not exists shopping_items_remind_on_idx
  on public.shopping_items(remind_on);

create index if not exists reminder_delivery_logs_list_id_idx
  on public.reminder_delivery_logs(list_id);

drop trigger if exists shopping_lists_set_updated_at on public.shopping_lists;
create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row execute procedure public.set_updated_at();

drop trigger if exists shopping_items_set_updated_at on public.shopping_items;
create trigger shopping_items_set_updated_at
before update on public.shopping_items
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      name = coalesce(public.profiles.name, excluded.name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_members enable row level security;
alter table public.shopping_items enable row level security;
alter table public.reminder_delivery_logs enable row level security;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_read_list_members" on public.profiles;
create policy "profiles_read_list_members" on public.profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1
      from public.shopping_lists l
      left join public.shopping_list_members m on m.list_id = l.id
      where (
        l.owner_user_id = profiles.id
        or m.user_id = profiles.id
      )
      and (
        l.visibility = 'public_link'
        or l.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.shopping_list_members mm
          where mm.list_id = l.id and mm.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "list_read_shared_or_public" on public.shopping_lists;
create policy "list_read_shared_or_public" on public.shopping_lists
  for select using (
    auth.uid() = owner_user_id
    or exists (
      select 1
      from public.shopping_list_members m
      where m.list_id = shopping_lists.id and m.user_id = auth.uid()
    )
    or visibility = 'public_link'
  );

drop policy if exists "list_insert_owner" on public.shopping_lists;
create policy "list_insert_owner" on public.shopping_lists
  for insert with check (auth.uid() = owner_user_id);

drop policy if exists "list_update_owner" on public.shopping_lists;
create policy "list_update_owner" on public.shopping_lists
  for update using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "list_delete_owner" on public.shopping_lists;
create policy "list_delete_owner" on public.shopping_lists
  for delete using (auth.uid() = owner_user_id);

drop policy if exists "member_read_with_access" on public.shopping_list_members;
create policy "member_read_with_access" on public.shopping_list_members
  for select using (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = shopping_list_members.list_id
      and (
        l.visibility = 'public_link'
        or l.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.shopping_list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "member_write_owner" on public.shopping_list_members;
create policy "member_write_owner" on public.shopping_list_members
  for all using (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = shopping_list_members.list_id
      and l.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = shopping_list_members.list_id
      and l.owner_user_id = auth.uid()
    )
  );

drop policy if exists "item_read_with_access" on public.shopping_items;
create policy "item_read_with_access" on public.shopping_items
  for select using (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = shopping_items.list_id
      and (
        (
          shopping_items.scope = 'shared'
          and (
            l.visibility = 'public_link'
            or l.owner_user_id = auth.uid()
            or exists (
              select 1
              from public.shopping_list_members m
              where m.list_id = l.id and m.user_id = auth.uid()
            )
          )
        )
        or (
          shopping_items.scope = 'personal'
          and shopping_items.created_by_user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "item_write_shared_members" on public.shopping_items;
create policy "item_write_shared_members" on public.shopping_items
  for all using (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = shopping_items.list_id
      and (
        l.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.shopping_list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
    )
  )
  with check (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = shopping_items.list_id
      and (
        l.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.shopping_list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "reminder_logs_owner_only" on public.reminder_delivery_logs;
create policy "reminder_logs_owner_only" on public.reminder_delivery_logs
  for all using (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = reminder_delivery_logs.list_id
        and l.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.shopping_lists l
      where l.id = reminder_delivery_logs.list_id
        and l.owner_user_id = auth.uid()
    )
  );
