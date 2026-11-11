-- A document register: one type in one FY, newest first; "contains" search on number or party
-- name; optional status, party and date-range filters; paged, with the total. :q arrives with LIKE
-- wildcards escaped.
with input as (
  select :company_id::integer as company_id, :type::text as type, :fy::integer as fy,
    '%' || :q::nullable(text) || '%' as pattern, :status::nullable(text) as status,
    :party_id::nullable(integer) as party_id, :date_from::nullable(date) as date_from, :date_to::nullable(date) as date_to
)
select d.id, d.number, d.date, d.status, d.party_id, d.party_name, d.due_date, d.party_ref, d.challan_type, d.vehicle_no,
  d.grand_total::float8 as grand_total,
  -- Total qty and what's still to convert, for "Delivered / Partly / Not yet" on orders and the like.
  (select sum(l.qty) from document_lines l where l.document_id = d.id)::float8 as ordered_qty,
  (select sum(l.qty - coalesce((
     select sum(k.qty) from document_links k
     join document_lines t on t.id = k.to_line_id
     join documents td on td.id = t.document_id
     where k.from_line_id = l.id and td.status <> 'cancelled'
   ), 0)) from document_lines l where l.document_id = d.id)::float8 as pending_qty,
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
