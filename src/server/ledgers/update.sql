-- Renames or moves a ledger. No row when the ledger or the group isn't this company's.
-- System ledgers are refused by the protect_system trigger (0009_ledgers.sql).
with input as (
  select :id::integer as id, :company_id::integer as company_id, :group_id::integer as group_id, :name::text as name
)
update ledgers l
set name = input.name, group_id = g.id
from input
join ledger_groups g on g.id = input.group_id and g.company_id = input.company_id
where l.id = input.id and l.company_id = input.company_id
returning l.id
