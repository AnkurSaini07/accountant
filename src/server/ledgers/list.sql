-- The ledger list: "contains" search on the ledger's or its group's name ("bank" finds every bank
-- ledger); inactive hidden unless asked; paged, with the total. :q arrives with LIKE wildcards escaped.
with input as (
  select :company_id::integer as company_id, '%' || :q::nullable(text) || '%' as pattern,
    :include_inactive::boolean as include_inactive
)
select l.id, l.name, l.group_id, g.name as group_name, g.nature, l.is_system, l.active,
  count(*) over ()::int as total
from input
join ledgers l on l.company_id = input.company_id
join ledger_groups g on g.id = l.group_id
where (input.pattern is null or l.name ilike input.pattern or g.name ilike input.pattern)
  and (input.include_inactive or l.active)
order by lower(l.name), l.id
limit :limit offset :offset
