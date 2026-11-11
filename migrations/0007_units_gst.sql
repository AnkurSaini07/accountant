-- Units of measure (UQC codes as GST returns use them) and GST rates (FR-3.2, FR-3.3).
-- Shared by every company: they're GST's lists, not the company's.

create table units (
  id integer generated always as identity primary key,
  code text not null unique check (code ~ '^[A-Z]{3}$'), -- UQC, e.g. KGS
  name text not null check (btrim(name) <> ''),
  -- Quantities are integers in the smallest unit (NFR-1): 3 decimals means 1.250 KGS is stored as 1250.
  decimals integer not null default 0 check (decimals between 0 and 3),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into units (code, name, decimals) values
  ('NOS', 'Numbers', 0),
  ('PCS', 'Pieces', 0),
  ('KGS', 'Kilograms', 3),
  ('MTR', 'Metres', 3),
  ('SET', 'Sets', 0),
  ('LTR', 'Litres', 3),
  ('BOX', 'Box', 0);

-- Rates are data, not code: they change (FR-3.3). A document uses the rate in force on its date,
-- so old rates stay; new ones are added with their effective date.
create table gst_rates (
  id integer generated always as identity primary key,
  rate numeric(5, 2) not null check (rate >= 0 and rate <= 100), -- percent, e.g. 18.00
  effective_from date not null,
  active boolean not null default true, -- offered for new items
  created_at timestamptz not null default now(),
  unique (rate, effective_from)
);

-- Slabs since GST began (1 July 2017), and 40% from the GST rationalisation (22 September 2025),
-- which also moved most 12% and 28% goods to 5% and 18%. 12% and 28% stay for the few goods
-- still at them and for older documents.
insert into gst_rates (rate, effective_from) values
  (0, '2017-07-01'),
  (0.25, '2017-07-01'),
  (3, '2017-07-01'),
  (5, '2017-07-01'),
  (12, '2017-07-01'),
  (18, '2017-07-01'),
  (28, '2017-07-01'),
  (40, '2025-09-22');
