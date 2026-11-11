-- The group tree in display order: each primary group, then its sub-groups (depth 1, 2, …).
with recursive tree as (
  select g.id, g.parent_id, g.name, g.nature, g.is_system, 0 as depth, array[lower(g.name)] as path
  from ledger_groups g
  where g.company_id = :company_id and g.parent_id is null
  union all
  select c.id, c.parent_id, c.name, c.nature, c.is_system, t.depth + 1, t.path || lower(c.name)
  from ledger_groups c
  join tree t on c.parent_id = t.id
)
select id, parent_id, name, nature, is_system, depth::int as depth
from tree
order by path
