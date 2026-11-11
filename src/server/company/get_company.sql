-- v1 has one company (FR-1.2); the first row is it. Addresses and bank accounts in saved order.
select c.id, c.legal_name, c.trade_name, c.state_code, c.gstin, c.pan, c.phone, c.email,
  c.logo, c.signature, c.terms, c.updated_at,
  coalesce((
    select json_agg(json_build_object('id', a.id, 'label', a.label, 'address', a.address, 'city', a.city,
      'pincode', a.pincode, 'is_primary', a.is_primary) order by a.id)
    from company_addresses a where a.company_id = c.id
  ), '[]'::json) as addresses,
  coalesce((
    select json_agg(json_build_object('id', b.id, 'bank_name', b.bank_name, 'account_name', b.account_name,
      'account_number', b.account_number, 'ifsc', b.ifsc, 'branch', b.branch, 'is_default', b.is_default) order by b.id)
    from company_bank_accounts b where b.company_id = c.id
  ), '[]'::json) as bank_accounts
from companies c
order by c.id
limit 1
