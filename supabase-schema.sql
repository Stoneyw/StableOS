-- ============================================================
--  StableOS — Supabase Schema
--  Run this in the Supabase SQL Editor (Project → SQL Editor)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Companies ────────────────────────────────────────────────
create table companies (
  id              bigserial primary key,
  name            text not null,
  slug            text unique,
  location        text,
  address         text,
  phone           text,
  website         text,
  plan            text not null default 'Professional',
  facility_type   text,
  status          text not null default 'active',
  joined          text,
  owner_email     text,
  created_at      timestamptz default now()
);

-- ── Users (linked to Supabase Auth) ─────────────────────────
create table users (
  id          bigserial primary key,
  auth_id     uuid references auth.users(id) on delete cascade,
  company_id  bigint references companies(id) on delete cascade,
  name        text,
  email       text not null,
  role        text not null default 'boarder',
  avatar      text,
  phone       text,
  created_at  timestamptz default now()
);
create index on users(auth_id);
create index on users(company_id);

-- Helper: get the company_id for the current signed-in user
create or replace function get_my_company_id()
returns bigint language sql stable security definer as $$
  select company_id from users where auth_id = auth.uid() limit 1;
$$;

-- Helper: is the current user a platform admin?
create table platform_admins (
  id          bigserial primary key,
  auth_id     uuid references auth.users(id) on delete cascade,
  name        text,
  email       text unique not null
);
create or replace function is_platform_admin()
returns boolean language sql stable security definer as $$
  select exists (select 1 from platform_admins where auth_id = auth.uid());
$$;

-- ── Horses ───────────────────────────────────────────────────
create table horses (
  id          bigserial primary key,
  company_id  bigint not null references companies(id) on delete cascade,
  name        text not null,
  breed       text,
  coat        text,
  sex         text,
  location    text,
  board_type  text,
  owner_id    bigint references users(id) on delete set null,
  status      text not null default 'active',
  notes       text,
  created_at  timestamptz default now()
);
create index on horses(company_id);

-- ── Feed Rations ─────────────────────────────────────────────
create table feed_rations (
  id          bigserial primary key,
  company_id  bigint not null references companies(id) on delete cascade,
  horse_id    bigint not null references horses(id) on delete cascade,
  meal        text not null,  -- 'am' | 'pm'
  ration      text,
  notes       text,
  unique(company_id, horse_id, meal)
);

-- ── Feed Log ─────────────────────────────────────────────────
create table feed_log (
  id          bigserial primary key,
  company_id  bigint not null references companies(id) on delete cascade,
  horse_id    bigint not null references horses(id) on delete cascade,
  meal        text not null,
  date        date not null,
  fed_by      bigint references users(id) on delete set null,
  fed_at      timestamptz default now(),
  unique(company_id, horse_id, meal, date)
);

-- ── Health Records ───────────────────────────────────────────
create table health_records (
  id            bigserial primary key,
  company_id    bigint not null references companies(id) on delete cascade,
  horse_id      bigint not null references horses(id) on delete cascade,
  type          text,  -- vaccination | farrier | coggins | vet_visit | deworming | dental
  title         text,
  performed_on  date,
  next_due_on   date,
  provider      text,
  cost          numeric(10,2),
  notes         text,
  created_at    timestamptz default now()
);
create index on health_records(company_id);
create index on health_records(next_due_on);

-- ── Events (calendar) ────────────────────────────────────────
create table events (
  id          bigserial primary key,
  company_id  bigint not null references companies(id) on delete cascade,
  title       text not null,
  type        text,  -- lesson | training | vet | farrier | other
  arena       text,
  horse_id    bigint references horses(id) on delete set null,
  staff_id    bigint references users(id) on delete set null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  notes       text
);
create index on events(company_id, starts_at);

-- ── Tasks ────────────────────────────────────────────────────
create table tasks (
  id           bigserial primary key,
  company_id   bigint not null references companies(id) on delete cascade,
  title        text not null,
  assignee_id  bigint references users(id) on delete set null,
  due_on       date,
  priority     text not null default 'normal',  -- high | normal | low
  done         boolean not null default false,
  done_at      timestamptz,
  created_at   timestamptz default now()
);
create index on tasks(company_id, due_on);

-- ── Invoices ─────────────────────────────────────────────────
create table invoices (
  id           bigserial primary key,
  company_id   bigint not null references companies(id) on delete cascade,
  boarder_id   bigint references users(id) on delete set null,
  horse_id     bigint references horses(id) on delete set null,
  number       text,
  period       text,  -- e.g. '2026-06'
  amount       numeric(10,2),
  status       text not null default 'sent',  -- sent | paid | overdue | draft
  due_on       date,
  paid_on      date,
  lines        jsonb,  -- [{description, qty, unitPrice}]
  created_at   timestamptz default now()
);
create index on invoices(company_id, status);

-- ── Messages ─────────────────────────────────────────────────
create table messages (
  id            bigserial primary key,
  company_id    bigint not null references companies(id) on delete cascade,
  sender_id     bigint references users(id) on delete set null,
  recipient_id  bigint references users(id) on delete set null,  -- null = board-wide
  body          text not null,
  read_at       timestamptz,
  created_at    timestamptz default now()
);
create index on messages(company_id, created_at desc);

-- ============================================================
--  Row Level Security
-- ============================================================

alter table companies      enable row level security;
alter table users          enable row level security;
alter table horses         enable row level security;
alter table feed_rations   enable row level security;
alter table feed_log       enable row level security;
alter table health_records enable row level security;
alter table events         enable row level security;
alter table tasks          enable row level security;
alter table invoices       enable row level security;
alter table messages       enable row level security;
alter table platform_admins enable row level security;

-- Companies: tenant sees only their own; platform admin sees all
create policy "tenant_companies" on companies for all
  using ( id = get_my_company_id() or is_platform_admin() );

-- Users: tenant sees only their company; platform admin sees all
create policy "tenant_users" on users for all
  using ( company_id = get_my_company_id() or is_platform_admin() );

-- All tenant tables: scope to company_id
create policy "tenant_horses"   on horses          for all using ( company_id = get_my_company_id() or is_platform_admin() );
create policy "tenant_rations"  on feed_rations    for all using ( company_id = get_my_company_id() or is_platform_admin() );
create policy "tenant_feedlog"  on feed_log        for all using ( company_id = get_my_company_id() or is_platform_admin() );
create policy "tenant_health"   on health_records  for all using ( company_id = get_my_company_id() or is_platform_admin() );
create policy "tenant_events"   on events          for all using ( company_id = get_my_company_id() or is_platform_admin() );
create policy "tenant_tasks"    on tasks           for all using ( company_id = get_my_company_id() or is_platform_admin() );
create policy "tenant_invoices" on invoices        for all using ( company_id = get_my_company_id() or is_platform_admin() );
create policy "tenant_messages" on messages        for all using ( company_id = get_my_company_id() or is_platform_admin() );

-- Platform admins: only other admins can read the table
create policy "padmins_only"    on platform_admins for all using ( is_platform_admin() );

-- ============================================================
--  Seed your first platform admin
--  Replace the uuid with the auth.uid() from Supabase Auth
--  after you create the admin account in Authentication → Users
-- ============================================================
-- insert into platform_admins (auth_id, name, email)
-- values ('YOUR-AUTH-UUID-HERE', 'Stoney W.', 'stoneyw@gmail.com');
