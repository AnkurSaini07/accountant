-- One party with its addresses: billing first, then shipping in saved order.
select p.id, p.name, p.kind, p.registration_type, p.gstin, p.pan, p.state_code, p.contact_person, p.phone, p.email,
  p.credit_days, p.credit_limit::float8 as credit_limit, p.opening_balance::float8 as opening_balance,
  p.active, p.updated_at,
  coalesce((
    select json_agg(json_build_object('id', a.id, 'kind', a.kind, 'label', a.label, 'address', a.address,
      'city', a.city, 'pincode', a.pincode, 'state_code', a.state_code) order by a.kind, a.id)
    from party_addresses a where a.party_id = p.id
  ), '[]'::json) as addresses
from parties p
where p.id = :id and p.company_id = :company_id
