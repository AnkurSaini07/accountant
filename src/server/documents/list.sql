-- A document register: one type in one FY, newest first; "contains" search on number or party
-- name; optional status, party and date-range filters; paged, with the total. :q arrives with LIKE
-- wildcards escaped.
with input as (
  select :company_id::integer as company_id, :type::text as type, :fy::integer as fy,
    '%' || :q::nullable(text) || '%' as pattern, :status::nullable(text) as status,
    :party_id::nullable(integer) as party_id, :date_from::nullable(date) as date_from, :date_to::nullable(date) as date_to
)
select d.id, d.number, d.date, d.status, d.party_id, d.party_name, d.due_date,
  d.grand_total::float8 as grand_total,
  count(*) over ()::int as total
from input i
join documents d on d.company_id = i.company_id and d.type = i.type and d.fy = i.fy
where (i.pattern is null or d.number ilike i.pattern or d.party_name ilike i.pattern)
  and (i.status is null or d.status = i.status)
  and (i.party_id is null or d.party_id = i.party_id)
  and (i.date_from is null or d.date >= i.date_from)
  and (i.date_to is null or d.date <= i.date_to)
order by d.date desc, d.id desc
limit :limit offset :offset
