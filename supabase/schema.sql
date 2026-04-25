create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists shopping_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  visibility text not null check (visibility in ('private', 'shared', 'public_link')),
  owner_user_id uuid not null references profiles(id) on delete cascade,
  public_token text unique,
  daily_reminder_enabled boolean not null default true,
  daily_reminder_hour text not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shopping_list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  invited_by_user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (list_id, user_id)
);

create table if not exists shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  title text not null,
  quantity text not null default '1',
  note text not null default '',
  status text not null check (status in ('pending', 'purchased')) default 'pending',
  due_date date,
  due_time text,
  reminder_enabled boolean not null default true,
  created_by_user_id uuid not null references profiles(id) on delete cascade,
  updated_by_user_id uuid not null references profiles(id) on delete cascade,
  purchased_by_user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reminder_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  delivery_date date not null,
  status text not null check (status in ('sent', 'skipped')),
  sent_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (list_id, delivery_date)
);

alter table profiles enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_members enable row level security;
alter table shopping_items enable row level security;
alter table reminder_delivery_logs enable row level security;

create policy "profiles_read_own" on profiles
  for select using (auth.uid() = id);

create policy "list_read_shared_or_public" on shopping_lists
  for select using (
    auth.uid() = owner_user_id
    or exists (
      select 1 from shopping_list_members m
      where m.list_id = shopping_lists.id and m.user_id = auth.uid()
    )
    or visibility = 'public_link'
  );

create policy "list_write_owner" on shopping_lists
  for all using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "member_read_with_access" on shopping_list_members
  for select using (
    exists (
      select 1 from shopping_lists l
      where l.id = shopping_list_members.list_id
      and (
        l.owner_user_id = auth.uid()
        or exists (
          select 1 from shopping_list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
    )
  );

create policy "member_write_owner" on shopping_list_members
  for all using (
    exists (
      select 1 from shopping_lists l
      where l.id = shopping_list_members.list_id
      and l.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from shopping_lists l
      where l.id = shopping_list_members.list_id
      and l.owner_user_id = auth.uid()
    )
  );

create policy "item_read_with_access" on shopping_items
  for select using (
    exists (
      select 1 from shopping_lists l
      where l.id = shopping_items.list_id
      and (
        l.visibility = 'public_link'
        or l.owner_user_id = auth.uid()
        or exists (
          select 1 from shopping_list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
    )
  );

create policy "item_write_shared_members" on shopping_items
  for all using (
    exists (
      select 1 from shopping_lists l
      where l.id = shopping_items.list_id
      and (
        l.owner_user_id = auth.uid()
        or exists (
          select 1 from shopping_list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
    )
  )
  with check (
    exists (
      select 1 from shopping_lists l
      where l.id = shopping_items.list_id
      and (
        l.owner_user_id = auth.uid()
        or exists (
          select 1 from shopping_list_members m
          where m.list_id = l.id and m.user_id = auth.uid()
        )
      )
    )
  );

create policy "reminder_logs_owner_only" on reminder_delivery_logs
  for all using (
    exists (
      select 1 from shopping_lists l
      where l.id = reminder_delivery_logs.list_id and l.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from shopping_lists l
      where l.id = reminder_delivery_logs.list_id and l.owner_user_id = auth.uid()
    )
  );
