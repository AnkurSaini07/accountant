-- Customers and suppliers (FR-3.1). Never deleted once used, only deactivated (FR-3.5).
create extension if not exists pg_trgm; -- "contains" search on names, see parties_name_search

create table parties (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id),
  name text not null check (btrim(name) <> ''),
  kind text not null check (kind in ('customer', 'supplier', 'both')),
  -- GST registration decides whether a GSTIN exists: regular and composition dealers have one;
  -- unregistered businesses and consumers (B2C) don't.
  registration_type text not null check (registration_type in ('regular', 'composition', 'unregistered', 'consumer')),
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  state_code text not null check (state_code ~ '^[0-9]{2}$'), -- decides CGST+SGST vs IGST
  contact_person text,
  phone text,
  email text,
  credit_days integer not null default 0 check (credit_days between 0 and 365),
  -- Money in paise (src/shared/money.ts). Kept within JS safe integers, so reading as float8 is exact.
  credit_limit bigint check (credit_limit between 0 and 9007199254740991), -- null = no limit
  opening_balance bigint not null default 0 check (abs(opening_balance) <= 9007199254740991), -- + Dr (owes us), − Cr (we owe)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, gstin), -- one party per GSTIN; several unregistered parties (null) are fine
  check ((gstin is not null) = (registration_type in ('regular', 'composition'))),
  check (gstin is null or (state_code = left(gstin, 2) and pan = substr(gstin, 3, 10)))
);
create trigger set_updated_at before update on parties for each row execute function set_updated_at();
create index parties_company_kind on parties (company_id, kind) where active;
create index parties_name_search on parties using gin (name gin_trgm_ops);

-- One billing address (on invoices) and any number of shipping addresses. Each has its own state:
-- goods shipped to another state change the place of supply. Documents copy the address they use.
create table party_addresses (
  id integer generated always as identity primary key,
  party_id integer not null references parties (id) on delete cascade,
  kind text not null check (kind in ('billing', 'shipping')),
  label text, -- e.g. "Plant 2"
  address text not null default '',
  city text not null default '',
  pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  state_code text not null check (state_code ~ '^[0-9]{2}$')
);
create index party_addresses_party_id on party_addresses (party_id);
create unique index party_addresses_one_billing on party_addresses (party_id) where kind = 'billing';
