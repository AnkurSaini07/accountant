-- The firm whose books these are (FR-1.1). One company in v1 (seeded below), but a table, so a second
-- firm can be added later (FR-1.2). Shown on every document's letterhead.
create table companies (
  id integer generated always as identity primary key,
  legal_name text not null check (btrim(legal_name) <> ''),
  trade_name text,
  state_code text not null check (state_code ~ '^[0-9]{2}$'),
  -- When set, GSTIN decides state and PAN: chars 1-2 are the state code, 3-12 the PAN.
  gstin text unique check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  phone text,
  email text,
  -- Images as data: URLs (PNG/JPEG/WebP). Small, and printed on every document.
  logo text,
  signature text,
  terms text not null default '', -- default terms & conditions on documents
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (gstin is null or (state_code = left(gstin, 2) and pan = substr(gstin, 3, 10)))
);
create trigger set_updated_at before update on companies for each row execute function set_updated_at();

-- Registered office, factory, godown… All in the company's state: under one GSTIN every place of
-- business is in its state (another state means another GSTIN, i.e. another company).
-- Documents copy the address they print, so editing these never changes an issued document.
create table company_addresses (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id) on delete cascade,
  label text not null check (btrim(label) <> ''), -- e.g. "Registered office", "Factory"
  address text not null default '', -- street lines, as printed
  city text not null default '',
  pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  is_primary boolean not null default false -- the letterhead address (principal place of business)
);
create index company_addresses_company_id on company_addresses (company_id);
create unique index company_addresses_one_primary on company_addresses (company_id) where is_primary;

-- Documents copy the account they print, as with addresses.
create table company_bank_accounts (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id) on delete cascade,
  bank_name text not null check (btrim(bank_name) <> ''),
  account_name text, -- holder name, when it differs from the legal name
  account_number text not null check (account_number ~ '^[0-9A-Z]{6,20}$'),
  ifsc text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  branch text,
  is_default boolean not null default false, -- printed on invoices unless another is chosen
  unique (company_id, account_number)
);
create unique index company_bank_accounts_one_default on company_bank_accounts (company_id) where is_default;

-- Placeholder until the admin fills in Settings → Company. Haryana (06): the factory is in Faridabad.
with c as (insert into companies (legal_name, state_code) values ('My Company', '06') returning id)
insert into company_addresses (company_id, label, city, is_primary) select id, 'Registered office', 'Faridabad', true from c;
