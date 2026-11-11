-- The party list: "contains" search on name, GSTIN or phone; optional kind filter (a 'both' party
-- matches either kind); inactive hidden unless asked; paged, with the total for the pager.
-- :q arrives with LIKE wildcards escaped (parties.ts).
with input as (
  select :company_id::integer as company_id, '%' || :q::nullable(text) || '%' as pattern, :kind::nullable(text) as kind,
    :include_inactive::boolean as include_inactive
)
select p.id, p.name, p.kind, p.registration_type, p.gstin, p.state_code, p.phone, b.city, p.active,
  p.opening_balance::float8 as opening_balance,
  count(*) over ()::int as total
from input i
join parties p on p.company_id = i.company_id
left join party_addresses b on b.party_id = p.id and b.kind = 'billing'
where (i.pattern is null or p.name ilike i.pattern or p.gstin ilike i.pattern or p.phone ilike i.pattern)
  and (i.kind is null or p.kind = i.kind or p.kind = 'both')
  and (i.include_inactive or p.active)
order by lower(p.name), p.id
limit :limit offset :offset
