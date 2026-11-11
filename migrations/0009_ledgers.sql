-- Chart of accounts (FR-3.4): a Tally-like tree of ledger groups, and the ledgers posted to.
-- Each company has its own; every new company gets the defaults (seed_chart_of_accounts below).

create table ledger_groups (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id),
  parent_id integer references ledger_groups (id), -- null = a primary group
  name text not null check (btrim(name) <> ''),
  -- Decides which statement a group lands in: balance sheet (asset, liability) or P&L (income, expense).
  nature text not null check (nature in ('asset', 'liability', 'income', 'expense')),
  is_system boolean not null default false, -- seeded: can't be changed or deleted
  created_at timestamptz not null default now()
);
create unique index ledger_groups_company_name on ledger_groups (company_id, lower(name));
create index ledger_groups_parent on ledger_groups (parent_id);

-- A sub-group has its parent's nature (Sundry Debtors is an asset because Current Assets is) and
-- belongs to the same company.
create function ledger_group_matches_parent() returns trigger language plpgsql as $$
declare parent ledger_groups;
begin
  if new.parent_id is not null then
    select * into parent from ledger_groups where id = new.parent_id;
    if parent.company_id <> new.company_id or parent.nature <> new.nature then
      raise exception 'ledger group "%" must have the same company and nature as its parent "%"', new.name, parent.name
        using errcode = 'check_violation', constraint = 'ledger_groups_parent_nature';
    end if;
  end if;
  return new;
end $$;
create trigger matches_parent before insert or update on ledger_groups for each row execute function ledger_group_matches_parent();

create table ledgers (
  id integer generated always as identity primary key,
  company_id integer not null references companies (id),
  group_id integer not null references ledger_groups (id),
  name text not null check (btrim(name) <> ''),
  -- How code finds the ledgers it posts to (invoice → 'sales', 'output_cgst', …), whatever they're called.
  system_key text check (system_key ~ '^[a-z_]+$'),
  is_system boolean not null default false, -- seeded: can't be changed or deleted
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, system_key),
  check (system_key is null or is_system)
);
create unique index ledgers_company_name on ledgers (company_id, lower(name));
create index ledgers_group on ledgers (group_id);
create trigger set_updated_at before update on ledgers for each row execute function set_updated_at();

-- Seeded rows are the accounting skeleton invoices post to: refuse any change or delete.
-- The argument is what to call the row in the message ("ledger", "ledger group").
create function refuse_system_row_change() returns trigger language plpgsql as $$
begin
  raise exception '% is a system % and can''t be changed or deleted', old.name, tg_argv[0]
    using errcode = 'check_violation', constraint = tg_table_name || '_system';
end $$;
create trigger protect_system before update or delete on ledger_groups for each row when (old.is_system) execute function refuse_system_row_change('ledger group');
create trigger protect_system before update or delete on ledgers for each row when (old.is_system) execute function refuse_system_row_change('ledger');

-- Tally's primary groups and the common sub-groups, plus the ledgers every GST invoice needs.
create function seed_chart_of_accounts(company integer) returns void language sql as $$
  insert into ledger_groups (company_id, name, nature, is_system) values
    (company, 'Capital Account', 'liability', true),
    (company, 'Loans (Liability)', 'liability', true),
    (company, 'Current Liabilities', 'liability', true),
    (company, 'Fixed Assets', 'asset', true),
    (company, 'Investments', 'asset', true),
    (company, 'Current Assets', 'asset', true),
    (company, 'Sales Accounts', 'income', true),
    (company, 'Direct Incomes', 'income', true),
    (company, 'Indirect Incomes', 'income', true),
    (company, 'Purchase Accounts', 'expense', true),
    (company, 'Direct Expenses', 'expense', true),
    (company, 'Indirect Expenses', 'expense', true);

  insert into ledger_groups (company_id, parent_id, name, nature, is_system)
  select company, p.id, c.name, p.nature, true
  from (values
    ('Current Liabilities', 'Duties & Taxes'),
    ('Current Liabilities', 'Sundry Creditors'),
    ('Current Liabilities', 'Provisions'),
    ('Current Assets', 'Bank Accounts'),
    ('Current Assets', 'Cash-in-Hand'),
    ('Current Assets', 'Sundry Debtors'),
    ('Current Assets', 'Stock-in-Hand'),
    ('Current Assets', 'Deposits (Asset)'),
    ('Current Assets', 'Loans & Advances (Asset)')
  ) as c(parent, name)
  join ledger_groups p on p.company_id = company and p.name = c.parent;

  insert into ledgers (company_id, group_id, name, system_key, is_system)
  select company, g.id, l.name, l.key, true
  from (values
    ('Cash-in-Hand', 'Cash', 'cash'),
    ('Sales Accounts', 'Sales', 'sales'),
    ('Purchase Accounts', 'Purchase', 'purchase'),
    ('Duties & Taxes', 'Output CGST', 'output_cgst'),
    ('Duties & Taxes', 'Output SGST', 'output_sgst'),
    ('Duties & Taxes', 'Output IGST', 'output_igst'),
    ('Duties & Taxes', 'Input CGST', 'input_cgst'),
    ('Duties & Taxes', 'Input SGST', 'input_sgst'),
    ('Duties & Taxes', 'Input IGST', 'input_igst'),
    ('Indirect Expenses', 'Round Off', 'round_off')
  ) as l(grp, name, key)
  join ledger_groups g on g.company_id = company and g.name = l.grp;
$$;

create function seed_new_company() returns trigger language plpgsql as $$
begin
  perform seed_chart_of_accounts(new.id);
  return new;
end $$;
create trigger seed_chart after insert on companies for each row execute function seed_new_company();

select seed_chart_of_accounts(id) from companies;
