-- Only under one of this company's groups: no row when the group is unknown or another company's.
insert into ledgers (company_id, group_id, name)
select g.company_id, g.id, :name::text
from ledger_groups g
where g.id = :group_id::integer and g.company_id = :company_id::integer
returning id
