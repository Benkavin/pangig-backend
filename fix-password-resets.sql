-- Drop and recreate password_resets table cleanly
drop table if exists password_resets;

create table password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index idx_password_resets_token on password_resets(token);
create index idx_password_resets_user_id on password_resets(user_id);

-- Allow service role full access
alter table password_resets enable row level security;
create policy "service_role_all" on password_resets for all to service_role using (true);
