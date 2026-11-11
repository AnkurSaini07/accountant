-- Every business document in one table (REQUIREMENTS "Data model"): quotations, orders, challans,
-- invoices, notes, POs, GRNs and purchase bills share a header and lines, and differ by `type`.
-- Types match number_series.doc_type. Money is paise and quantities are the unit's smallest step,
-- all bigint within JS safe integers (read as float8, exact).

create table documents (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id),
  type text not null check (type in (
    'quotation', 'sales_order', 'challan', 'invoice', 'credit_note',
    'purchase_order', 'grn', 'purchase_bill', 'debit_note'
  )),
  fy integer not null, -- start year: 2026 = FY 2026-27
  number text check (char_length(number) between 1 and 16), -- GST: at most 16 characters
  date date not null,
  -- Quotation: Draft → Sent → Accepted / Rejected / Expired. Invoice and the rest: Draft →
  -- Finalized → (Cancelled). Which moves are allowed per type is the document service's job.
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'finalized', 'cancelled')),
  party_id integer not null references parties (id),

  -- The party as it was on the document (snapshot_party below): later edits to the party don't
  -- rewrite issued documents. Addresses are {label, address, city, pincode, state_code}.
  party_name text not null,
  party_gstin text,
  party_state_code text not null,
  billing_address jsonb,
  shipping_address jsonb, -- the caller's choice of ship-to; null = same as billing
  place_of_supply text not null check (place_of_supply ~ '^[0-9]{2}$'), -- decides CGST+SGST vs IGST
  reverse_charge boolean not null default false,

  party_ref text, -- the party's own number: customer PO no. (sales order), supplier invoice no. (purchase bill)
  party_ref_date date,
  due_date date, -- quotation: valid until; PO: delivery by; invoice: payment due
  -- Delivery challans (FR-4.3).
  challan_type text check (challan_type in ('sale', 'job_work', 'approval', 'returnable')),
  vehicle_no text,
  transporter text,
  eway_bill_no text check (eway_bill_no ~ '^[0-9]{12}$'),

  -- Totals, worked out by the totals service (#39) from the lines.
  taxable_total bigint not null default 0 check (taxable_total between 0 and 9007199254740991),
  cgst_total bigint not null default 0 check (cgst_total between 0 and 9007199254740991),
  sgst_total bigint not null default 0 check (sgst_total between 0 and 9007199254740991),
  igst_total bigint not null default 0 check (igst_total between 0 and 9007199254740991),
  round_off bigint not null default 0 check (abs(round_off) < 100), -- to the nearest rupee, posted to Round Off
  grand_total bigint not null default 0 check (grand_total between 0 and 9007199254740991),

  notes text not null default '',
  terms text not null default '',
  created_by integer references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (company_id, type, fy, number), -- numbers are unique within the FY (FR-1.4); drafts have none yet
  check (fy = extract(year from date - interval '3 months')), -- the FY the date falls in (1 April – 31 March)
  check (number is not null or status = 'draft'), -- a draft gets its number when it's issued
  check ((challan_type is not null) = (type = 'challan'))
);
create trigger set_updated_at before update on documents for each row execute function set_updated_at();
create index documents_list on documents (company_id, type, fy, date desc);
create index documents_party on documents (party_id);

-- Copies the party's name, GSTIN, state and billing address onto the document when it's created and
-- on every save while it's a draft (so issuing it takes the party as it is then); once issued it
-- keeps what it had. A null place of supply becomes the ship-to state (goods are supplied where
-- they're delivered), else the party's: the service sends null to have it worked out again.
create function snapshot_party() returns trigger language plpgsql as $$
declare p parties;
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    return new;
  end if;
  select * into p from parties where id = new.party_id and company_id = new.company_id;
  if not found then
    raise exception 'party % is not one of this company''s parties', new.party_id
      using errcode = 'foreign_key_violation', constraint = 'documents_party_id_fkey';
  end if;
  new.party_name := p.name;
  new.party_gstin := p.gstin;
  new.party_state_code := p.state_code;
  new.billing_address := (
    select jsonb_build_object('label', a.label, 'address', a.address, 'city', a.city, 'pincode', a.pincode, 'state_code', a.state_code)
    from party_addresses a where a.party_id = p.id and a.kind = 'billing'
  );
  new.place_of_supply := coalesce(new.place_of_supply, new.shipping_address ->> 'state_code', p.state_code);
  return new;
end $$;
create trigger snapshot_party before insert or update on documents for each row execute function snapshot_party();

create table document_lines (
  id integer generated always as identity primary key,
  document_id integer not null references documents (id) on delete cascade,
  position integer not null check (position >= 1),
  item_id integer not null references items (id),
  description text not null default '', -- printed under the item name
  -- Snapshots of the item (snapshot_item below), so the line prints the same forever.
  item_name text not null,
  hsn text,
  unit text not null,
  unit_decimals integer not null,
  qty bigint not null check (qty between 1 and 9007199254740991), -- in the unit's smallest step
  rate bigint not null check (rate between 0 and 9007199254740991), -- paise per whole unit
  discount_bp integer not null default 0 check (discount_bp between 0 and 10000), -- 1250 = 12.50%
  gst_rate numeric(5, 2) not null check (gst_rate between 0 and 100),
  -- Worked out by the totals service (#39).
  taxable bigint not null default 0 check (taxable between 0 and 9007199254740991),
  cgst bigint not null default 0 check (cgst between 0 and 9007199254740991),
  sgst bigint not null default 0 check (sgst between 0 and 9007199254740991),
  igst bigint not null default 0 check (igst between 0 and 9007199254740991),
  unique (document_id, position)
);
create index document_lines_item on document_lines (item_id);

-- Copies the item's name, HSN and unit onto a line when it's added or its item changes.
create function snapshot_item() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.item_id = old.item_id then
    return new;
  end if;
  select i.name, i.hsn, u.code, u.decimals into new.item_name, new.hsn, new.unit, new.unit_decimals
  from items i
  join units u on u.id = i.unit_id
  join documents d on d.id = new.document_id and d.company_id = i.company_id
  where i.id = new.item_id;
  if not found then
    raise exception 'item % is not one of this company''s items', new.item_id
      using errcode = 'foreign_key_violation', constraint = 'document_lines_item_id_fkey';
  end if;
  return new;
end $$;
create trigger snapshot_item before insert or update on document_lines for each row execute function snapshot_item();

-- Conversions (quotation → order → challan → invoice, PO → GRN → bill): how much of a line went
-- into a line of the next document. Pending qty = line qty − sum of links out. Which documents
-- came from which follows from the lines.
create table document_links (
  from_line_id integer not null references document_lines (id),
  to_line_id integer not null references document_lines (id) on delete cascade,
  qty bigint not null check (qty between 1 and 9007199254740991),
  primary key (from_line_id, to_line_id),
  check (from_line_id <> to_line_id)
);
create index document_links_to on document_links (to_line_id);
