-- ══════════════════════════════════════════════
-- PANGIG DATABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ══════════════════════════════════════════════

-- USERS
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  phone text,
  role text not null check (role in ('client', 'contractor')),
  location text,
  services text[] default '{}',
  credits integer default 0,
  status text default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz default now()
);

-- JOBS
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  description text not null,
  location text,
  budget text,
  client_id uuid references users(id) on delete cascade,
  client_email text,
  client_phone text,
  unlocked_by text[] default '{}',
  status text default 'open' check (status in ('open', 'closed', 'completed')),
  created_at timestamptz default now()
);

-- INVOICES
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references users(id) on delete cascade,
  client_name text not null,
  client_email text,
  job_description text,
  items jsonb not null default '[]',
  total numeric(10,2) not null default 0,
  status text default 'pending' check (status in ('pending', 'paid', 'overdue')),
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- CREDIT TRANSACTIONS
create table if not exists credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action text not null,
  credits integer not null,
  amount_paid numeric(10,2),
  currency text,
  payment_method text,
  stripe_session_id text,
  paystack_reference text,
  created_at timestamptz default now()
);

-- PRICING (per service)
create table if not exists pricing (
  service_id text primary key,
  credits integer not null default 5,
  updated_at timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────
create index if not exists idx_users_email on users(email);
create index if not exists idx_users_role on users(role);
create index if not exists idx_jobs_client on jobs(client_id);
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_invoices_contractor on invoices(contractor_id);
create index if not exists idx_transactions_user on credit_transactions(user_id);

-- ── ROW LEVEL SECURITY ────────────────────────────
alter table users enable row level security;
alter table jobs enable row level security;
alter table invoices enable row level security;
alter table credit_transactions enable row level security;
alter table pricing enable row level security;

-- Allow service role (backend) full access
create policy "service_role_all" on users for all using (true);
create policy "service_role_all" on jobs for all using (true);
create policy "service_role_all" on invoices for all using (true);
create policy "service_role_all" on credit_transactions for all using (true);
create policy "service_role_all" on pricing for all using (true);

-- ── SEED DEFAULT PRICING ─────────────────────────
insert into pricing (service_id, credits) values
  ('renovation', 12), ('carpentry', 6), ('roofing', 10), ('painting', 4),
  ('flooring', 6), ('masonry', 8), ('drywall', 5), ('windows-doors', 5),
  ('insulation', 5), ('siding', 7), ('plumbing', 5), ('hvac', 8),
  ('heating', 7), ('gas-fitting', 8), ('water-heater', 6), ('electrical', 6),
  ('solar', 14), ('ev-charger', 8), ('smart-home', 7), ('security-systems', 7),
  ('landscaping', 4), ('lawn-care', 2), ('tree-service', 7), ('cleaning', 2),
  ('deep-cleaning', 3), ('pest-control', 4), ('security-guard', 6),
  ('event-security', 7), ('bodyguard', 12), ('moving', 3), ('packing', 2),
  ('general-contractor', 15), ('foundation', 14), ('concrete', 8),
  ('auto-repair', 5), ('auto-detailing', 3), ('catering', 6),
  ('photography', 7), ('event-planning', 8), ('personal-training', 4),
  ('massage', 3), ('home-nursing', 6), ('accounting', 6), ('legal', 10),
  ('web-dev', 7), ('consulting', 8)
on conflict (service_id) do nothing;

-- ── PASSWORD RESETS ───────────────────────────────
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists idx_password_resets_token on password_resets(token);

-- ── REVIEWS ──────────────────────────────────────
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references users(id) on delete cascade,
  client_id uuid references users(id) on delete cascade,
  client_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique(contractor_id, client_id)
);
create index if not exists idx_reviews_contractor on reviews(contractor_id);

-- ── ADD RATING COLUMNS TO USERS ───────────────────
alter table users add column if not exists avg_rating numeric(3,2) default 0;
alter table users add column if not exists review_count integer default 0;
alter table users add column if not exists verified boolean default false;
alter table users add column if not exists company_name text;
alter table users add column if not exists license_number text;
alter table users add column if not exists years_experience integer;
alter table users add column if not exists bio text;
alter table users add column if not exists logo_url text;
alter table users add column if not exists website text;

-- Allow service role full access on new tables
create policy "service_role_all" on password_resets for all using (true);
create policy "service_role_all" on reviews for all using (true);
