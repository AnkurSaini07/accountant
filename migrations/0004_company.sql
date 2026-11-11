-- The firm whose books these are (FR-1.1). One company in v1 (seeded below), but a table, so a second
-- firm can be added later (FR-1.2). Shown on every document's letterhead.
create table companies (
  id integer generated always as identity primary key,
  legal_name text not null check (btrim(legal_name) <> ''),
  trade_name text,
  address text not null default '', -- street lines, as printed
  city text not null default '',
  pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  state_code text not null check (state_code ~ '^[0-9]{2}$'),
  -- When set, GSTIN decides state and PAN: chars 1-2 are the state code, 3-12 the PAN.
  gstin text unique check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  phone text,
  email text,
  bank_name text,
  bank_account text,
  bank_ifsc text check (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_branch text,
  -- Images as data: URLs (PNG/JPEG/WebP). Small, and printed on every document.
  logo text,
  signature text,
  terms text not null default '', -- default terms & conditions on documents
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gstin is null or (state_code = left(gstin, 2) and pan = substr(gstin, 3, 10)))
);
create trigger set_updated_at before update on companies for each row execute function set_updated_at();

-- Placeholder until the admin fills in Settings → Company. Haryana (06): the factory is in Faridabad.
insert into companies (legal_name, city, state_code) values ('My Company', 'Faridabad', '06');
