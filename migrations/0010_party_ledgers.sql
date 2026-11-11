-- Every party has its own ledger (FR-3.4), under Sundry Debtors (customers, and parties that are
-- both) or Sundry Creditors (suppliers). A trigger keeps it in step, so creating, renaming,
-- re-kinding or (de)activating a party changes its ledger in the same transaction, whatever the
-- write path. A clash with another ledger's name fails the party write (ledgers_company_name).

alter table ledgers add column party_id integer unique references parties (id);
alter table ledgers add check (party_id is null or not is_system);

create function sync_party_ledger() returns trigger language plpgsql as $$
begin
  insert into ledgers (company_id, group_id, name, active, party_id)
  select new.company_id, g.id, new.name, new.active, new.id
  from ledger_groups g
  -- System groups can't be renamed (protect_system), so finding them by name is safe.
  where g.company_id = new.company_id and g.is_system
    and g.name = case when new.kind = 'supplier' then 'Sundry Creditors' else 'Sundry Debtors' end
  on conflict (party_id) do update set name = excluded.name, group_id = excluded.group_id, active = excluded.active;
  return null;
end $$;
create trigger sync_ledger after insert or update of name, kind, active on parties
  for each row execute function sync_party_ledger();

update parties set name = name; -- gives existing parties their ledgers
