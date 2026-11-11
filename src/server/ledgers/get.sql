-- One ledger, with its group's name and nature. party_id: a party's own ledger (0010_party_ledgers.sql).
select l.id, l.name, l.group_id, g.name as group_name, g.nature, l.is_system, l.party_id, l.active, l.updated_at
from ledgers l
join ledger_groups g on g.id = l.group_id
where l.id = :id and l.company_id = :company_id
