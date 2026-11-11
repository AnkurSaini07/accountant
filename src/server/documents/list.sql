-- A document register: one type in one FY, newest first; "contains" search on number or party
-- name; optional status filter; paged, with the total. :q arrives with LIKE wildcards escaped.
with input as (
  select :company_id::integer as company_id, :type::text as type, :fy::integer as fy,
    '%' || :q::nullable(text) || '%' as pattern, :status::nullable(text) as status
)
select d.id, d.number, d.date, d.status, d.party_id, d.party_name, d.due_date,
  d.grand_total::float8 as grand_total,
  count(*) over ()::int as total
from input i
join documents d on d.company_id = i.company_id and d.type = i.type and d.fy = i.fy
where (i.pattern is null or d.number ilike i.pattern or d.party_name ilike i.pattern)
  and (i.status is null or d.status = i.status)
order by d.date desc, d.id desc
limit :limit offset :offset
