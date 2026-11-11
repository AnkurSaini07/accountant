-- Document numbers (FR-1.4): one counter per company, document type and financial year, so
-- numbering restarts every 1 April. A row appears the first time a type is numbered in an FY.
create table number_series (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id),
  doc_type text not null check (doc_type in (
    'quotation', 'sales_order', 'challan', 'invoice', 'credit_note', 'debit_note',
    'purchase_order', 'grn', 'purchase_bill', 'receipt', 'payment', 'journal', 'contra'
  )),
  fy integer not null check (fy between 2000 and 2999), -- start year: 2026 = FY 2026-27
  -- Text before the number. {FY} becomes the short FY label: 'INV/{FY}/' → 'INV/26-27/'.
  -- GST allows letters, digits, '/' and '-' in invoice numbers.
  prefix text not null check (replace(prefix, '{FY}', '') ~ '^[A-Za-z0-9/-]*$'),
  next_number integer not null default 1 check (next_number >= 1),
  padding integer not null default 4 check (padding between 1 and 8), -- 4 → 0001
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, doc_type, fy)
);
create trigger set_updated_at before update on number_series for each row execute function set_updated_at();
