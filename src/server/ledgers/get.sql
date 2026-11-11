-- One ledger, with its group's name and nature.
select l.id, l.name, l.group_id, g.name as group_name, g.nature, l.is_system, l.active, l.updated_at
from ledgers l
join ledger_groups g on g.id = l.group_id
where l.id = :id and l.company_id = :company_id
