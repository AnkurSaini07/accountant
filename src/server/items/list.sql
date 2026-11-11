-- The item list: "contains" search on code, name or HSN; optional type filter; inactive hidden
-- unless asked; paged, with the total for the pager. :q arrives with LIKE wildcards escaped (items.ts).
with input as (
  select :company_id::integer as company_id, '%' || :q::nullable(text) || '%' as pattern,
    :type::nullable(text) as type, :include_inactive::boolean as include_inactive
)
select i.id, i.code, i.name, i.type, i.hsn, u.code as unit, g.rate::float8 as gst_rate,
  i.sale_price::float8 as sale_price, i.active,
  count(*) over ()::int as total
from input
join items i on i.company_id = input.company_id
join units u on u.id = i.unit_id
join gst_rates g on g.id = i.gst_rate_id
where (input.pattern is null or i.code ilike input.pattern or i.name ilike input.pattern or i.hsn ilike input.pattern)
  and (input.type is null or i.type = input.type)
  and (input.include_inactive or i.active)
order by lower(i.name), i.id
limit :limit offset :offset
