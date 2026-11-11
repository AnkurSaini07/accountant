-- Items (FR-3.2): what the factory buys, makes and sells. Never deleted once used, only deactivated (FR-3.5).
create table items (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id),
  code text not null check (code ~ '^[A-Za-z0-9][A-Za-z0-9/_.-]{0,29}$'), -- the user's own code, e.g. FG-101
  name text not null check (btrim(name) <> ''),
  description text not null default '',
  type text not null check (type in ('raw', 'semi', 'finished', 'service')),
  -- HSN (goods) or SAC (services, starts 99). Real codes are 4, 6 or 8 digits.
  hsn text check (hsn ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})$'),
  unit_id integer not null references units (id),
  gst_rate_id integer not null references gst_rates (id),
  -- Money in paise, quantities in the unit's smallest step (units.decimals: 1.250 KGS = 1250).
  -- All within JS safe integers, so reading them as float8 is exact.
  sale_price bigint not null default 0 check (sale_price between 0 and 9007199254740991),
  purchase_price bigint not null default 0 check (purchase_price between 0 and 9007199254740991),
  opening_qty bigint not null default 0 check (opening_qty between 0 and 9007199254740991),
  opening_value bigint not null default 0 check (opening_value between 0 and 9007199254740991),
  reorder_level bigint check (reorder_level between 0 and 9007199254740991), -- null = no alert
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'service' or (opening_qty = 0 and opening_value = 0 and reorder_level is null)), -- services hold no stock
  check (opening_qty > 0 or opening_value = 0) -- a value needs stock to be the value of
);
-- One item per code per company, whatever the case: "fg-101" and "FG-101" are the same code.
create unique index items_company_code on items (company_id, lower(code));
create trigger set_updated_at before update on items for each row execute function set_updated_at();
create index items_company_type on items (company_id, type) where active;
create index items_name_search on items using gin (name gin_trgm_ops);
