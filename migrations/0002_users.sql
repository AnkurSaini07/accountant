-- People who can sign in. Identity lives in Pocket ID (OIDC); no passwords are stored here.
create table users (
  id integer generated always as identity primary key,
  oidc_sub text not null unique, -- the ID token's `sub`: stable per user in Pocket ID
  email text,
  name text not null,
  -- From Pocket ID groups (accountant-admin, …), refreshed on every login.
  role text not null check (role in ('admin', 'accountant', 'operator', 'viewer')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on users for each row execute function set_updated_at();

-- Browser sessions. The cookie holds a random 256-bit token; only its SHA-256 is stored, so a
-- leaked database (or backup) can't be replayed as a login.
create table sessions (
  token_hash text primary key,
  user_id integer not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_user_id on sessions (user_id);
